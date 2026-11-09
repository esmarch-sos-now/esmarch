"""`run_call` and the resumable socket, against fakes at the boundary `run_call` uses (no network, no OpenAI)."""

import asyncio
import json
import time
from collections.abc import Callable, Iterator
from contextlib import ExitStack, asynccontextmanager
from typing import Any, cast

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.core import config
from app.voice import call as voice_call
from app.voice import router as voice_router
from app.voice.call import CHECK_INS, CheckIns, ending_soon_line, run_call
from app.voice.resume import ResumableTransport, registry

pytestmark = pytest.mark.anyio

ORIGIN = {"Origin": "http://localhost:3000"}


# ---- CheckIns ---------------------------------------------------------------------------------------------


class Clock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def test_check_ins_wait_for_silence_rotate_lines_and_stop_at_the_limit() -> None:
    clock = Clock()
    check_ins = CheckIns(20, 2, clock)
    assert check_ins.due("guiding") is None
    clock.now += 19
    assert check_ins.due("guiding") is None
    clock.now += 1
    assert check_ins.due("guiding") == CHECK_INS["guiding"][0]
    assert check_ins.due("guiding") is None  # the timer restarted
    clock.now += 20
    assert check_ins.due("guiding") == CHECK_INS["guiding"][1]
    clock.now += 100
    assert check_ins.due("guiding") is None  # two unanswered: it stops


def test_check_ins_restart_when_the_caller_speaks_and_skip_phases_without_lines() -> None:
    clock = Clock()
    check_ins = CheckIns(10, 1, clock)
    clock.now += 10
    assert check_ins.due("triage") is None  # nothing to say while triaging
    assert check_ins.due("monitoring") == CHECK_INS["monitoring"][0]
    clock.now += 10
    assert check_ins.due("monitoring") is None  # limit reached
    check_ins.activity(caller=True)
    clock.now += 10
    assert check_ins.due("monitoring") == CHECK_INS["monitoring"][0]  # the count started over
    check_ins.activity()  # the assistant's own activity only delays the next one
    clock.now += 9
    assert check_ins.due("monitoring") is None


def test_check_ins_can_be_turned_off() -> None:
    clock = Clock()
    check_ins = CheckIns(0, 3, clock)
    clock.now += 1000
    assert check_ins.due("guiding") is None


# ---- fakes for run_call -----------------------------------------------------------------------------------


class FakeTransport:
    """A browser that sends an offer and then stays silent until `stop`."""

    def __init__(self, *messages: dict[str, Any]) -> None:
        self.sent: list[dict[str, Any]] = []
        self.inbox: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()
        for message in messages:
            self.inbox.put_nowait(message)

    async def send_json(self, data: dict[str, Any]) -> None:
        self.sent.append(data)

    async def receive(self) -> dict[str, Any] | None:
        return await self.inbox.get()

    def types(self) -> list[str]:
        return [m["type"] for m in self.sent]


class Answer:
    sdp = "answer-sdp"
    session = object()


class FakeSession:
    def __init__(self, hang_up_error: Exception | None = None) -> None:
        self.hang_ups = 0
        self._error = hang_up_error

    def stream_transcripts(self, *, delta: bool) -> FakeSession:
        return self

    def __aiter__(self) -> FakeSession:
        return self

    async def __anext__(self) -> Any:
        await asyncio.Event().wait()  # no events, ever

    async def hang_up(self) -> None:
        self.hang_ups += 1
        if self._error:
            raise self._error


class FakeRealtime:
    def __init__(
        self,
        session: FakeSession,
        *,
        attach_error: Exception | None = None,
        offer_error: Exception | None = None,
    ) -> None:
        self.fake_session, self.attach_error, self.offer_error = session, attach_error, offer_error
        self.hang_ups = 0

    async def answer_webrtc_offer(self, sdp: str) -> Answer:
        if self.offer_error:
            raise self.offer_error
        return Answer()

    @asynccontextmanager
    async def session(self, *, provider_session: object):
        if self.attach_error:
            raise self.attach_error
        yield self.fake_session

    async def hang_up(self, provider_session: object) -> None:
        assert provider_session is Answer.session
        self.hang_ups += 1


class FakeAgent:
    def __init__(self, realtime: FakeRealtime) -> None:
        self._realtime = realtime

    def realtime(self, model: object, **kwargs: Any) -> FakeRealtime:
        return self._realtime


@pytest.fixture
def commentary(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    said: list[str] = []

    async def send_context(session: object, kind: str, text: str) -> None:
        assert kind == "commentary"
        said.append(text)

    monkeypatch.setattr(voice_call, "send_context", send_context)
    return said


def use(monkeypatch: pytest.MonkeyPatch, realtime: FakeRealtime) -> None:
    monkeypatch.setattr(voice_call, "build_agent", lambda: FakeAgent(realtime))


async def call(transport: Any, **kwargs: Any) -> str:
    return await run_call(
        transport, cast(Any, object()), duration_seconds=kwargs.pop("duration_seconds", 5), settings={}, **kwargs
    )  # type: ignore[arg-type]


OFFER = {"type": "offer", "sdp": "offer-sdp"}


async def test_a_call_that_stops_hangs_up_once_and_sends_the_call_id(
    monkeypatch: pytest.MonkeyPatch, commentary: list[str]
) -> None:
    session = FakeSession()
    realtime = FakeRealtime(session)
    use(monkeypatch, realtime)
    transport = FakeTransport(OFFER, {"type": "stop"})
    assert await call(transport, call_id="secret") == "stopped"
    assert transport.sent[0] == {"type": "answer", "sdp": "answer-sdp", "callId": "secret"}
    assert (session.hang_ups, realtime.hang_ups) == (1, 0)


async def test_no_offer_in_time_is_its_own_reason(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(voice_call, "OFFER_TIMEOUT_SECONDS", 0.05)
    assert await call(FakeTransport()) == "no_offer"


async def test_a_failed_sideband_attach_still_hangs_the_call_up(
    monkeypatch: pytest.MonkeyPatch, commentary: list[str]
) -> None:
    realtime = FakeRealtime(FakeSession(), attach_error=RuntimeError("sideband refused"))
    use(monkeypatch, realtime)
    transport = FakeTransport(OFFER)
    assert await call(transport) == "error"
    assert realtime.hang_ups == 1  # no session object existed: hung up through the realtime model
    assert transport.types() == ["answer", "error"]


async def test_cancellation_after_the_answer_hangs_up(monkeypatch: pytest.MonkeyPatch, commentary: list[str]) -> None:
    session = FakeSession()
    realtime = FakeRealtime(session)
    use(monkeypatch, realtime)
    task = asyncio.create_task(call(FakeTransport(OFFER)))
    await asyncio.sleep(0.05)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert session.hang_ups + realtime.hang_ups == 1


async def test_a_failing_hang_up_is_logged_and_retried_through_the_model(
    monkeypatch: pytest.MonkeyPatch, commentary: list[str]
) -> None:
    session = FakeSession(hang_up_error=RuntimeError("provider refused"))
    realtime = FakeRealtime(session)
    use(monkeypatch, realtime)
    assert await call(FakeTransport(OFFER, {"type": "stop"})) == "stopped"  # not raised
    assert (session.hang_ups, realtime.hang_ups) == (1, 1)


async def test_a_failure_before_the_answer_ends_with_error(monkeypatch: pytest.MonkeyPatch) -> None:
    realtime = FakeRealtime(FakeSession(), offer_error=RuntimeError("openai down"))
    use(monkeypatch, realtime)
    transport = FakeTransport(OFFER)
    assert await call(transport) == "error"
    assert realtime.hang_ups == 0  # there was no upstream session to end
    assert transport.types() == ["error"]


async def test_the_caller_is_warned_before_the_time_limit(
    monkeypatch: pytest.MonkeyPatch, commentary: list[str]
) -> None:
    use(monkeypatch, FakeRealtime(FakeSession()))
    transport = FakeTransport(OFFER)
    assert await call(transport, duration_seconds=1.5, end_warning_seconds=1) == "time_limit"
    assert {"type": "ending_soon", "seconds": 1} in transport.sent
    assert commentary[-1] == ending_soon_line(1)
    assert "115" in commentary[-1]


async def test_no_warning_when_disabled(monkeypatch: pytest.MonkeyPatch, commentary: list[str]) -> None:
    use(monkeypatch, FakeRealtime(FakeSession()))
    transport = FakeTransport(OFFER)
    assert await call(transport, duration_seconds=0.2, end_warning_seconds=0) == "time_limit"
    assert "ending_soon" not in transport.types()


async def test_the_hand_off_ends_the_call_without_polling(
    monkeypatch: pytest.MonkeyPatch, commentary: list[str]
) -> None:
    from app.voice.agent import CallSession

    monkeypatch.setattr(voice_call, "HANDOFF_END_SECONDS", 0.05)
    monkeypatch.setattr(voice_call, "HANDOFF_PAUSE_SECONDS", 0)
    session, made = FakeSession(), []
    realtime = FakeRealtime(session)
    original = FakeAgent.realtime

    def spy(self: FakeAgent, model: object, *, deps: CallSession, **kwargs: Any) -> FakeRealtime:
        made.append(deps)
        return original(self, model)

    monkeypatch.setattr(FakeAgent, "realtime", spy)
    use(monkeypatch, realtime)
    task = asyncio.create_task(call(FakeTransport(OFFER)))
    await asyncio.sleep(0.1)
    assert not task.done()
    from app.voice.call_state import Handoff

    made[0].dispatch(Handoff())
    assert await asyncio.wait_for(task, 2) == "completed"


def test_the_sideband_may_reconnect() -> None:
    from app.core.config import Settings

    assert voice_call.live_settings(Settings(openai_api_key="k"))["reconnect"]["max_attempts"] == 5  # type: ignore[typeddict-item]


# ---- ResumableTransport ----------------------------------------------------------------------------------


class FakeSocket:
    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []
        self.inbox: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()
        self.closed = False

    async def send_json(self, data: dict[str, Any]) -> None:
        if self.closed:
            raise RuntimeError("closed")
        self.sent.append(data)

    async def receive(self) -> dict[str, Any] | None:
        return await self.inbox.get()

    async def close(self, code: int = 1000, reason: str = "") -> None:
        self.closed = True

    def drop(self) -> None:
        self.closed = True
        self.inbox.put_nowait(None)


async def test_a_drop_then_a_resume_within_grace_delivers_what_was_missed() -> None:
    first, second = FakeSocket(), FakeSocket()
    transport = ResumableTransport(first, grace_seconds=5)
    await transport.send_json({"type": "answer", "sdp": "s", "callId": "c"})
    first.drop()
    got = asyncio.create_task(transport.receive())
    await asyncio.sleep(0.05)
    assert not got.done()  # the call goes on, waiting
    await transport.send_json({"type": "signs", "awake": False})
    await transport.send_json({"type": "transcript", "speaker": "user", "index": 0, "text": "dropped"})
    released = await transport.attach(second)
    assert released is not None and first.closed
    assert (await got) == {"type": "resumed"}
    await transport.send_json({"type": "phase", "phase": "triage"})  # the call's reply to `resumed`
    second.inbox.put_nowait({"type": "ui_step", "guideId": "g", "stepIndex": 1})
    assert (await transport.receive()) == {
        "type": "ui_step",
        "guideId": "g",
        "stepIndex": 1,
    }  # buffered messages go out ahead of it
    assert [m["type"] for m in second.sent] == ["resumed", "phase", "signs"]
    await transport.finish("completed")
    assert second.sent[-1] == {"type": "ended", "reason": "completed"}
    assert released is not None and released.is_set()


async def test_a_drop_past_the_grace_period_ends_the_call() -> None:
    socket = FakeSocket()
    transport = ResumableTransport(socket, grace_seconds=0.1)
    await transport.send_json({"type": "answer", "sdp": "s", "callId": "c"})
    socket.drop()
    started = time.monotonic()
    assert await transport.receive() is None
    assert 0.08 < time.monotonic() - started < 2


async def test_stop_and_a_drop_before_the_answer_do_not_wait_for_a_resume() -> None:
    early = FakeSocket()
    transport = ResumableTransport(early, grace_seconds=30)
    early.drop()
    assert await asyncio.wait_for(transport.receive(), 1) is None  # no callId was handed out yet
    stopping = FakeSocket()
    transport = ResumableTransport(stopping, grace_seconds=30)
    await transport.send_json({"type": "answer", "sdp": "s", "callId": "c"})
    stopping.inbox.put_nowait({"type": "stop"})
    stopping.drop()
    assert (await transport.receive()) == {"type": "stop"}
    assert await asyncio.wait_for(transport.receive(), 1) is None


async def test_resume_off_means_a_drop_ends_the_call() -> None:
    socket = FakeSocket()
    transport = ResumableTransport(socket, grace_seconds=0)
    await transport.send_json({"type": "answer", "sdp": "s", "callId": "c"})
    socket.drop()
    assert await asyncio.wait_for(transport.receive(), 1) is None


async def test_a_second_resume_replaces_the_first_socket() -> None:
    first, second, third = FakeSocket(), FakeSocket(), FakeSocket()
    transport = ResumableTransport(first, grace_seconds=5)
    await transport.send_json({"type": "answer", "sdp": "s", "callId": "c"})
    released_second = await transport.attach(second)
    assert first.closed and released_second is not None
    released_third = await transport.attach(third)
    assert second.closed and released_second.is_set() and released_third is not None
    assert (await transport.receive()) == {"type": "resumed"}
    await transport.finish("stopped")
    assert await transport.attach(FakeSocket()) is None  # finished calls cannot be resumed


async def test_the_buffer_is_bounded() -> None:
    socket = FakeSocket()
    transport = ResumableTransport(socket, grace_seconds=5)
    await transport.send_json({"type": "answer", "sdp": "s", "callId": "c"})
    socket.drop()
    reader = asyncio.create_task(transport.receive())
    await asyncio.sleep(0.05)
    for i in range(500):
        await transport.send_json({"type": "signs", "n": i})
    fresh = FakeSocket()
    await transport.attach(fresh)
    await reader
    await transport.finish("stopped")
    assert len([m for m in fresh.sent if m["type"] == "signs"]) <= 50


# ---- the WebSocket route ---------------------------------------------------------------------------------


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[Callable[..., TestClient]]:
    def make(**env: str) -> TestClient:
        for key, value in {"OPENAI_API_KEY": "test-key", **env}.items():
            monkeypatch.setenv(key, value)
        config.get_settings.cache_clear()
        voice_router._limiter.cache_clear()  # noqa: SLF001
        monkeypatch.setattr(voice_router, "_active_calls", 0)
        monkeypatch.setattr(voice_router, "build_model", lambda s: object())
        app = FastAPI()
        app.include_router(voice_router.router)
        return stack.enter_context(TestClient(app))  # entered: every socket shares one event loop, as in production

    with ExitStack() as stack:
        yield make
    config.get_settings.cache_clear()
    voice_router._limiter.cache_clear()  # noqa: SLF001
    registry._calls.clear()  # noqa: SLF001


async def echo_call(transport: Any, model: object, *, call_id: str, **_: Any) -> str:
    """A stand-in for `run_call` with the same transport contract."""
    await transport.send_json({"type": "answer", "sdp": "s", "callId": call_id})
    while (message := await transport.receive()) is not None:
        match message["type"]:
            case "stop":
                return "stopped"
            case "resumed":
                await transport.send_json({"type": "phase", "phase": "triage"})
            case "ping":
                await transport.send_json({"type": "pong"})
    return "disconnected"


def wait_until(condition: Callable[[], bool]) -> None:
    deadline = time.monotonic() + 3
    while not condition():
        assert time.monotonic() < deadline, "timed out"
        time.sleep(0.01)


def start(ws: Any) -> str:
    ws.send_text(json.dumps({"type": "start", "consent": True}))
    answer = ws.receive_json()
    assert answer["type"] == "answer"
    return answer["callId"]


def test_a_dropped_socket_resumes_the_same_call_without_a_new_slot(
    client: Callable[..., TestClient], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(voice_router, "run_call", echo_call)
    test_client = client(VOICE_MAX_SESSIONS="1")
    # (Leaving the `with` would cancel the server's handler, so the drop is `close()` and the block stays open.)
    with test_client.websocket_connect("/api/voice/ws", headers=ORIGIN) as old:
        call_id = start(old)
        old.close()
        wait_until(registry.any_detached)
        assert voice_router._active_calls == 1  # noqa: SLF001  the call is still running
        with test_client.websocket_connect("/api/voice/ws", headers=ORIGIN) as ws:  # full house, yet a resume gets in
            ws.send_text(json.dumps({"type": "resume", "callId": call_id}))
            assert ws.receive_json() == {"type": "resumed"}
            assert ws.receive_json() == {"type": "phase", "phase": "triage"}
            ws.send_text(json.dumps({"type": "ping"}))
            assert ws.receive_json() == {"type": "pong"}
            assert voice_router._active_calls == 1  # noqa: SLF001
            ws.send_text(json.dumps({"type": "stop"}))
            assert ws.receive_json() == {"type": "ended", "reason": "stopped"}
    wait_until(lambda: voice_router._active_calls == 0)  # noqa: SLF001
    assert not registry._calls  # noqa: SLF001


def test_an_unknown_or_expired_call_id_is_closed_with_4404(
    client: Callable[..., TestClient], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(voice_router, "run_call", echo_call)
    test_client = client(VOICE_RESUME_GRACE_SECONDS="0.2")
    for call_id in ("nope", None, 7):
        with test_client.websocket_connect("/api/voice/ws", headers=ORIGIN) as ws:
            ws.send_text(json.dumps({"type": "resume", "callId": call_id}))
            with pytest.raises(WebSocketDisconnect) as closed:
                ws.receive_text()
            assert closed.value.code == 4404
    with test_client.websocket_connect("/api/voice/ws", headers=ORIGIN) as old:
        call_id = start(old)
        old.close()
        wait_until(lambda: not registry._calls)  # noqa: SLF001  grace ran out: the call ended and was removed
        with test_client.websocket_connect("/api/voice/ws", headers=ORIGIN) as ws:
            ws.send_text(json.dumps({"type": "resume", "callId": call_id}))
            with pytest.raises(WebSocketDisconnect) as closed:
                ws.receive_text()
            assert closed.value.code == 4404
    wait_until(lambda: voice_router._active_calls == 0)  # noqa: SLF001


def test_resume_still_needs_an_allowed_origin(
    client: Callable[..., TestClient], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(voice_router, "run_call", echo_call)
    test_client = client()
    with (
        pytest.raises(WebSocketDisconnect) as closed,
        test_client.websocket_connect("/api/voice/ws", headers={"Origin": "https://evil.example"}),
    ):
        pass
    assert closed.value.code == 1008


def test_a_setup_failure_ends_with_the_error_reason(
    client: Callable[..., TestClient], monkeypatch: pytest.MonkeyPatch
) -> None:
    use(monkeypatch, FakeRealtime(FakeSession(), offer_error=RuntimeError("openai down")))
    test_client = client()
    with test_client.websocket_connect("/api/voice/ws", headers=ORIGIN) as ws:
        ws.send_text(json.dumps({"type": "start", "consent": True}))
        ws.send_text(json.dumps(OFFER))
        assert ws.receive_json()["type"] == "error"
        assert ws.receive_json() == {"type": "ended", "reason": "error"}
    wait_until(lambda: voice_router._active_calls == 0)  # noqa: SLF001


def test_a_crashing_call_still_tells_the_browser(
    client: Callable[..., TestClient], monkeypatch: pytest.MonkeyPatch
) -> None:
    async def boom(*_: Any, **__: Any) -> str:
        raise RuntimeError("bug")

    monkeypatch.setattr(voice_router, "run_call", boom)
    test_client = client()
    with test_client.websocket_connect("/api/voice/ws", headers=ORIGIN) as ws:
        ws.send_text(json.dumps({"type": "start", "consent": True}))
        assert ws.receive_json() == {"type": "ended", "reason": "error"}
