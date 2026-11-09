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

Server -> browser
    {"type": "answer", "sdp"}                      the WebRTC answer
    {"type": "ready"}                              the call is live
    {"type": "transcript", "speaker": "user" | "assistant", "index", "text"}   caption of the turn so far
    {"type": "phase", "phase"} {"type": "signs", ...} {"type": "handoff", "summary"}
    {"type": "step", "guideId", "file", "stepIndex", ...}   open the 3D guide at a step
    {"type": "turn_complete"}
    {"type": "error", "message"} {"type": "ended", "reason"}
"""

import asyncio
import json
import logging
import re
import time
from collections.abc import Callable
from typing import Any, Protocol, cast

from pydantic_ai import FunctionToolCallEvent
from pydantic_ai.messages import (
    RealtimeSessionErrorEvent,
    RealtimeTurnCompleteEvent,
)
from pydantic_ai.realtime import RealtimeModel, RealtimeModelSettings

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
) -> str:
    """Serve one call until the browser leaves, says stop, the time limit passes, or the session fails.

    Returns why it ended. Audio and transcripts are never logged.
    """
    outbox: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
    call = CallSession(emit=outbox.put_nowait)
    reason = "closed"

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
    await transport.send_json({"type": "answer", "sdp": answer.sdp})

    async with realtime.session(provider_session=answer.session) as session:
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
                elif isinstance(event, RealtimeSessionErrorEvent):
                    log.warning("voice session error: %s", event.code or event.type)
                    await transport.send_json({"type": "error", "message": CALL_ERROR})

        async def pump_check_ins() -> None:
            while True:
                await asyncio.sleep(2)
                if line := check_ins.due(call.state.phase):
                    await send_context(session, "commentary", line)

        async def pump_hand_off() -> str:
            """End the call after the hand-over has been spoken (no one has to say goodbye by hand)."""
            while not call.handed_off:
                await asyncio.sleep(0.5)
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
                    case "ui_step":
                        gid, idx = message.get("guideId"), message.get("stepIndex")
                        if isinstance(gid, str) and isinstance(idx, int) and not isinstance(idx, bool):
                            call.sync_with_client(gid, idx)
            return "disconnected"

        await transport.send_json({"type": "ready"})
        await transport.send_json({"type": "phase", "phase": call.state.phase})
        start_greeting = asyncio.create_task(send_context(session, "commentary", GREETING_TEXT))

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
            for task in (browser, ender, *pumps, start_greeting):
                task.cancel()
            await asyncio.gather(browser, ender, *pumps, start_greeting, return_exceptions=True)
            try:
                await session.hang_up()  # closing alone leaves the browser connected to (and billed by) OpenAI
            except Exception:
                log.warning("voice hang up failed", exc_info=True)
    return reason


def parse_text(raw: str) -> dict[str, Any] | None:
    """A JSON object from the browser, or `None` if it is not one (ignored)."""
    try:
        data = json.loads(raw)
    except ValueError:
        return None
    return data if isinstance(data, dict) else None
