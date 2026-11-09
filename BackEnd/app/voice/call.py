"""Run one voice call: browser audio <-> realtime model, with the agent's tools in between.

GPT-Live (straight from OpenAI) hears the caller and speaks; a cheap backend model thinks and calls tools. What the
tools say about first aid reaches the caller in the model's own words (see `app.voice.agent`). This module adds the
time limit and the screen messages on top of the model.

Transport-agnostic (`Transport`) so the logic is testable without a socket; `router.py` adapts a WebSocket to it.

Audio does not pass through here: the browser talks to GPT-Live over WebRTC (mic and voice are media tracks). This
WebSocket only signals the call and carries the screen messages.

Browser -> server
    {"type": "start", "consent": true}
    {"type": "offer", "sdp"}                       the browser's WebRTC offer
    {"type": "ui_step", "guideId", "stepIndex"}   the caller moved the on-screen step by hand
    {"type": "stop"}
    {"type": "resume", "callId"}                   first message of a NEW socket for a call whose socket dropped

Server -> browser
    {"type": "answer", "sdp", "callId"}            the WebRTC answer; `callId` is the secret credential for `resume`
    {"type": "ready"}                              the call is live
    {"type": "transcript", "speaker": "user" | "assistant", "index", "text"}   caption of the turn so far
    {"type": "phase", "phase"} {"type": "signs", ...} {"type": "handoff", "summary"}
    {"type": "step", "guideId", "file", "stepIndex", ...}   open the 3D guide at a step
    {"type": "turn_complete"}
    {"type": "ending_soon", "seconds"}             the time limit is this many seconds away
    {"type": "resumed"}                            the new socket is attached; phase, step and missed messages follow
    {"type": "error", "message"} {"type": "ended", "reason"}

A socket that drops without `stop` leaves the call running for `voice_resume_grace_seconds` (`app.voice.resume`);
screen messages are buffered meanwhile (transcripts are dropped). A `resume` for an unknown or finished call is closed
with code 4404.

Why a call ended (`ended.reason`, always sent when a socket is still there):
    completed       the hand-over was spoken
    stopped         the browser sent `stop`
    disconnected    the browser went away (or never resumed within the grace period)
    time_limit      `voice_session_seconds` passed (`ending_soon` came first)
    no_offer        no WebRTC offer arrived in time
    session_ended   the realtime session ended by itself
    error           anything else that failed, before or during the call
"""

import asyncio
import contextlib
import json
import logging
import re
import time
from collections.abc import Awaitable, Callable
from typing import Any, Protocol, cast

from pydantic_ai import FunctionToolCallEvent
from pydantic_ai.agent import AgentRealtime
from pydantic_ai.messages import (
    RealtimeSessionErrorEvent,
    RealtimeSessionReconnectEvent,
    RealtimeTurnCompleteEvent,
)
from pydantic_ai.realtime import RealtimeModel, RealtimeModelSettings, ReconnectPolicy, WebRTCSession

from app.core.config import Settings
from app.voice.agent import LIVE_INSTRUCTIONS, CallSession, build_agent
from app.voice.call_state import GREETING_TEXT, CallPhase
from app.voice.live_model import SosnowLiveModel, send_context

log = logging.getLogger(__name__)

OFFER_TIMEOUT_SECONDS = 10.0
#: After the hand-over the call ends once the assistant has finished speaking, or after this long at the latest.
HANDOFF_END_SECONDS = 25.0
HANDOFF_PAUSE_SECONDS = 1.5

#: Live's transcription writes non-speech sounds in brackets ("[clear throat]"), and a bracket can arrive split across
#: two captions. Square brackets never belong to the caller's words, so complete, half-open and stray ones all go.
_NON_SPEECH = re.compile(r"\[[^\]]*(?:\]|$)|\]")


def clean_caption(text: str) -> str:
    return re.sub(r"\s+", " ", _NON_SPEECH.sub("", text)).strip()


CALL_ERROR = "Trợ lý đang gặp sự cố kết nối. Nếu khẩn cấp, hãy gọi 115 ngay."

#: A dropped sideband is re-attached to the same WebRTC session (the browser's audio never stopped).
RECONNECT: ReconnectPolicy = {"max_attempts": 5}


def ending_soon_line(seconds: int) -> str:
    """What the assistant says (in its own words) when the time limit is near."""
    left = f"khoảng {round(seconds / 60)} phút" if seconds >= 90 else f"khoảng {seconds} giây"
    return (
        f"Cuộc gọi này sẽ tự kết thúc sau {left} nữa. Bạn có thể gọi lại ngay sau đó. "
        "Nếu đây là tình huống khẩn cấp, hãy gọi 115."
    )


def live_settings(s: Settings) -> RealtimeModelSettings:
    """Its own spoken-persona prompt, and the cheap backend that runs the agent and its tools."""
    return cast(
        RealtimeModelSettings,
        {
            "thinking": s.voice_reasoning_effort,
            "openai_voice": s.voice_live_voice,
            "openai_live_instructions": LIVE_INSTRUCTIONS,
            "openai_live_turn_silence_ms": s.voice_live_turn_silence_ms,
            "openai_live_delegation": {"model": s.voice_live_backend, "reasoning_effort": s.voice_reasoning_effort},
            "reconnect": RECONNECT,
        },
    )


def build_model(s: Settings) -> SosnowLiveModel:
    """GPT-Live straight from OpenAI (the key is checked by `Settings.voice_configured`)."""
    return SosnowLiveModel(
        s.voice_live_model,
        api_key=s.openai_api_key,
        voice_id=s.voice_live_voice_id,
        acknowledgement_delay_ms=s.voice_ack_delay_ms,
    )


#: What the assistant says (as a commentary append, so in its own words) when the caller has said nothing for a while,
#: by phase. Several lines per phase so repeated check-ins do not sound alike. A step that needs silence (compressions)
#: is the model's call: it is told to stay quiet unless something is wrong.
CHECK_INS: dict[CallPhase, tuple[str, ...]] = {
    "guiding": (
        "Bạn làm được bước này chưa? Xong thì nói mình biết, cần mình nhắc lại cũng được.",
        "Mình vẫn ở đây. Bạn cứ làm từ từ, xong bước này thì nói mình.",
        "Bạn có vướng chỗ nào không? Nói mình nghe, mình chỉ lại liền.",
    ),
    "monitoring": (
        "Nạn nhân giờ sao rồi bạn? Còn tỉnh và còn thở không?",
        "Mình vẫn ở đây. Nạn nhân có gì thay đổi không bạn?",
        "Bạn kể mình nghe nạn nhân giờ thế nào.",
    ),
}


class CheckIns:
    """The silence timer: after `seconds` with nothing said or done, the next line for the phase, at most `limit` in a
    row (the caller speaking again starts the count over)."""

    def __init__(self, seconds: float, limit: int, clock: Callable[[], float] = time.monotonic) -> None:
        self._seconds, self._limit, self._clock = seconds, limit, clock
        self._last = clock()
        self._unanswered = 0

    def activity(self, *, caller: bool = False) -> None:
        self._last = self._clock()
        if caller:
            self._unanswered = 0

    def due(self, phase: CallPhase) -> str | None:
        lines = CHECK_INS.get(phase)
        if not lines or not self._seconds or self._unanswered >= self._limit:
            return None
        if self._clock() - self._last < self._seconds:
            return None
        line = lines[self._unanswered % len(lines)]
        self._unanswered += 1
        self._last = self._clock()
        return line


class Transport(Protocol):
    async def send_json(self, data: dict[str, Any]) -> None: ...
    async def receive(self) -> dict[str, Any] | None:
        """Next message from the browser: a JSON object, or `None` once it has disconnected."""
        ...


async def run_call(
    transport: Transport,
    model: RealtimeModel,
    *,
    duration_seconds: float,
    settings: RealtimeModelSettings,
    checkin_seconds: float = 0,
    checkin_max: int = 3,
    end_warning_seconds: float = 0,
    call_id: str | None = None,
) -> str:
    """Serve one call until the browser leaves, says stop, the time limit passes, or the session fails.

    Returns why it ended (see the module docstring); a failure anywhere is `"error"`, never an exception, so the
    caller can always tell the browser. Audio and transcripts are never logged.
    """
    try:
        return await _serve(
            transport,
            model,
            duration_seconds=duration_seconds,
            settings=settings,
            checkin_seconds=checkin_seconds,
            checkin_max=checkin_max,
            end_warning_seconds=end_warning_seconds,
            call_id=call_id,
        )
    except Exception:
        log.exception("voice call failed")
        with contextlib.suppress(Exception):  # the browser may be gone already
            await transport.send_json({"type": "error", "message": CALL_ERROR})
        return "error"


class _HangUp:
    """Ends the paid upstream call exactly once, by whichever route is available when the call is over."""

    def __init__(self) -> None:
        self.done = False

    async def __call__(self, end: Callable[[], Awaitable[None]]) -> None:
        if self.done:
            return
        try:
            await end()
            self.done = True
        except Exception:
            log.warning("voice hang up failed", exc_info=True)  # logged, never raised: the call is over regardless


async def _serve(
    transport: Transport,
    model: RealtimeModel,
    *,
    duration_seconds: float,
    settings: RealtimeModelSettings,
    checkin_seconds: float,
    checkin_max: int,
    end_warning_seconds: float,
    call_id: str | None,
) -> str:
    outbox: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
    call = CallSession(emit=outbox.put_nowait)

    try:
        async with asyncio.timeout(OFFER_TIMEOUT_SECONDS):
            offer = await transport.receive()
            while isinstance(offer, dict) and offer.get("type") != "offer":
                offer = await transport.receive()
    except TimeoutError:
        return "no_offer"
    if not isinstance(offer, dict) or not isinstance(offer.get("sdp"), str):
        return "disconnected"

    realtime = build_agent().realtime(model, deps=call, model_settings=settings)
    answer = await realtime.answer_webrtc_offer(offer["sdp"])
    hang_up = _HangUp()
    try:
        # From here the browser is connected to OpenAI and billed: every way out below must hang the call up.
        reply: dict[str, Any] = {"type": "answer", "sdp": answer.sdp}
        if call_id is not None:
            reply["callId"] = call_id
        await transport.send_json(reply)
        return await _talk(
            transport,
            realtime,
            answer.session,
            call,
            outbox,
            hang_up,
            duration_seconds=duration_seconds,
            checkin_seconds=checkin_seconds,
            checkin_max=checkin_max,
            end_warning_seconds=end_warning_seconds,
        )
    finally:
        await hang_up(lambda: realtime.hang_up(answer.session))


async def _talk(
    transport: Transport,
    realtime: AgentRealtime[CallSession],
    provider_session: WebRTCSession,
    call: CallSession,
    outbox: asyncio.Queue[dict[str, Any]],
    hang_up: _HangUp,
    *,
    duration_seconds: float,
    checkin_seconds: float,
    checkin_max: int,
    end_warning_seconds: float,
) -> str:
    reason = "error"
    async with realtime.session(provider_session=provider_session) as session:
        captions = session.stream_transcripts(delta=True)
        check_ins = CheckIns(checkin_seconds, checkin_max)
        handoff_spoken = asyncio.Event()

        async def pump_outbox() -> None:
            while True:
                await transport.send_json(await outbox.get())

        async def pump_captions() -> None:
            async for update in captions:
                speaker = "user" if update.speaker == "user" else "assistant"
                check_ins.activity(caller=speaker == "user")
                if text := clean_caption(update.transcript):
                    await transport.send_json(
                        {"type": "transcript", "speaker": speaker, "index": update.index, "text": text}
                    )

        async def pump_events() -> None:
            async for event in session:
                if isinstance(event, RealtimeTurnCompleteEvent):
                    if call.handed_off:
                        handoff_spoken.set()
                    await transport.send_json({"type": "turn_complete"})
                elif isinstance(event, FunctionToolCallEvent):
                    check_ins.activity()
                    log.info("voice tool: %s", event.part.tool_name)  # name only, never arguments
                elif isinstance(event, RealtimeSessionReconnectEvent):
                    log.info("voice sideband reconnected (state restored: %s)", event.state_restored)
                elif isinstance(event, RealtimeSessionErrorEvent):
                    log.warning(
                        "voice session error: %s (recoverable: %s)", event.code or event.type, event.recoverable
                    )
                    # A recoverable one leaves the call usable: the caller need not hear of it.
                    if not event.recoverable:
                        await transport.send_json({"type": "error", "message": CALL_ERROR})

        async def pump_check_ins() -> None:
            while True:
                await asyncio.sleep(2)
                if line := check_ins.due(call.state.phase):
                    await send_context(session, "commentary", line)

        async def warn_ending() -> None:
            """Tell the caller (screen and voice) that the time limit is near; the limit itself is not extended."""
            try:
                await asyncio.sleep(duration_seconds - end_warning_seconds)
                seconds = round(end_warning_seconds)
                await transport.send_json({"type": "ending_soon", "seconds": seconds})
                await send_context(session, "commentary", ending_soon_line(seconds))
            except Exception:
                log.warning("voice end warning failed", exc_info=True)

        async def pump_hand_off() -> str:
            """End the call after the hand-over has been spoken (no one has to say goodbye by hand)."""
            await call.handoff_dispatched.wait()
            try:
                await asyncio.wait_for(handoff_spoken.wait(), HANDOFF_END_SECONDS)
            except TimeoutError:
                pass
            await asyncio.sleep(HANDOFF_PAUSE_SECONDS)  # the last words are still playing in the browser
            return "completed"

        async def pump_browser() -> str:
            while (message := await transport.receive()) is not None:
                match message.get("type"):
                    case "stop":
                        return "stopped"
                    case "resumed":  # a new socket took over: redraw it (the transport adds what it missed)
                        await transport.send_json({"type": "phase", "phase": call.state.phase})
                        if step := call.current_step_message():
                            await transport.send_json(step)
                    case "ui_step":
                        gid, idx = message.get("guideId"), message.get("stepIndex")
                        if isinstance(gid, str) and isinstance(idx, int) and not isinstance(idx, bool):
                            call.sync_with_client(gid, idx)
            return "disconnected"

        await transport.send_json({"type": "ready"})
        await transport.send_json({"type": "phase", "phase": call.state.phase})
        start_greeting = asyncio.create_task(send_context(session, "commentary", GREETING_TEXT))
        warning = [asyncio.create_task(warn_ending())] if 0 < end_warning_seconds < duration_seconds else []

        pumps = [asyncio.create_task(p()) for p in (pump_outbox, pump_captions, pump_events, pump_check_ins)]
        browser = asyncio.create_task(pump_browser())
        ender = asyncio.create_task(pump_hand_off())
        try:
            async with asyncio.timeout(duration_seconds):
                done, _ = await asyncio.wait([browser, ender, *pumps], return_when=asyncio.FIRST_COMPLETED)
                for task in done:
                    if task is browser or task is ender:
                        reason = task.result()
                    else:
                        task.result()  # a failed pump ends the call with its error
                        reason = "session_ended"
        except TimeoutError:
            reason = "time_limit"
        finally:
            for task in (browser, ender, *pumps, start_greeting, *warning):
                task.cancel()
            await asyncio.gather(browser, ender, *pumps, start_greeting, *warning, return_exceptions=True)
            await hang_up(session.hang_up)  # closing alone leaves the browser connected to (and billed by) OpenAI
    return reason


def parse_text(raw: str) -> dict[str, Any] | None:
    """A JSON object from the browser, or `None` if it is not one (ignored)."""
    try:
        data = json.loads(raw)
    except ValueError:
        return None
    return data if isinstance(data, dict) else None
