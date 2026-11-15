"""Everything that talks to OpenAI GPT-Live. Each function is one short request, so it fits a serverless function.

- `start_session` turns the browser's WebRTC offer into a Live session (audio then flows browser <-> OpenAI). The
  browser's data channel may only *receive* captions and the backend's function calls; it may send nothing, so it
  cannot change the instructions, the tools or the conversation (checked against the live API: such events are
  answered with `event_not_allowed`).
- `send` attaches a sideband for a moment (about 0.6 s), sends events (tool results, things to say) and detaches.
  Live keeps the session running without a sideband, and a delegation waits for its tool results.
- `hang_up` ends a session over REST. A session whose browser vanished ends by itself (OpenAI closes it within
  seconds), so a 404 here means "already over".
"""

import asyncio
import json
import logging
import uuid
from collections.abc import Sequence
from functools import cache
from typing import Any, cast

import websockets
from openai import AsyncOpenAI, NotFoundError
from pydantic_ai.realtime import RealtimeModelSettings
from pydantic_ai.tools import ToolDefinition
from websockets.exceptions import InvalidStatus

from app.core.config import Settings
from app.voice.agent import INSTRUCTIONS, LIVE_INSTRUCTIONS, build_agent
from app.voice.live_model import MAX_APPEND_CHARS, SosnowLiveModel

log = logging.getLogger(__name__)

SIDEBAND_URL = "wss://api.openai.com/v1/live/sessions/{}/attach"
ACK_TIMEOUT_SECONDS = 4.0
_FRESH_SECONDS = 0.2

#: What the browser may receive. Not `session.started`/`session.updated`/`session.closed`: they carry the whole
#: session, backend instructions and tool definitions included.
BROWSER_SERVER_EVENTS: list[dict[str, str]] = [
    {"type": "session.input_transcript.delta"},
    {"type": "session.output_transcript.delta"},
    {"type": "error"},
    # The backend's function calls (the browser relays them to /tools) and the end of each backend response (when
    # the relayed batch goes out). Lifecycle snapshots carry no instructions or tools.
    {"type": "response.event", "response_event": "response.output_item.done"},
    {"type": "response.event", "response_event": "response.completed"},
]


class LiveError(Exception):
    """OpenAI refused or could not be reached."""


class SessionGone(LiveError):
    """OpenAI no longer has the session (hung up, timed out, or its browser went away)."""


def _gone(error: BaseException) -> bool:
    return isinstance(error, InvalidStatus) and error.response.status_code == 404


def live_settings(s: Settings) -> RealtimeModelSettings:
    return cast(
        RealtimeModelSettings,
        {
            "thinking": s.voice_reasoning_effort,
            "openai_voice": s.voice_live_voice,
            "openai_live_instructions": LIVE_INSTRUCTIONS,
            "openai_live_turn_silence_ms": s.voice_live_turn_silence_ms,
            "openai_live_delegation": {"model": s.voice_live_backend, "reasoning_effort": s.voice_reasoning_effort},
            "openai_live_data_channel": {"allowed_client_events": [], "allowed_server_events": BROWSER_SERVER_EVENTS},
        },
    )


def build_model(s: Settings) -> SosnowLiveModel:
    return SosnowLiveModel(
        s.voice_live_model,
        api_key=s.openai_api_key,
        voice_id=s.voice_live_voice_id,
        acknowledgement_delay_ms=s.voice_ack_delay_ms,
    )


@cache
def tool_definitions() -> tuple[ToolDefinition, ...]:
    """The agent's tools as the backend model sees them."""
    toolset = build_agent()._function_toolset  # pyright: ignore[reportPrivateUsage]
    return tuple(tool.tool_def for tool in toolset.tools.values())


async def start_session(s: Settings, sdp_offer: str) -> tuple[str, str]:
    """Start a Live session for the browser's offer: `(session id, SDP answer)`."""
    try:
        answer = await build_model(s).answer_webrtc_offer(
            sdp_offer, instructions=INSTRUCTIONS, tools=list(tool_definitions()), model_settings=live_settings(s)
        )
    except Exception as e:
        raise LiveError("could not start the Live session") from e
    return answer.session.session_id, answer.sdp


def tool_result_events(outputs: Sequence[tuple[str, str]]) -> list[dict[str, Any]]:
    """Function outputs for the backend, then one `response.create` so its delegation carries on."""
    events: list[dict[str, Any]] = [
        {"type": "response.item.create", "item": {"type": "function_call_output", "call_id": call_id, "output": out}}
        for call_id, out in outputs
    ]
    events.append({"type": "response.create"})
    return events


def commentary_event(text: str) -> dict[str, Any]:
    """Something Live should say, in its own words."""
    return {"type": "session.commentary.append", "delegation_id": None, "content": text[:MAX_APPEND_CHARS]}


async def send(s: Settings, session_id: str, events: list[dict[str, Any]]) -> None:
    """Deliver `events` on a short-lived sideband and wait until Live has taken the last one (or refused it).

    The attach replays the session's last few seconds of events, so acknowledgements are matched by `event_id`.
    """
    for event in events:
        event.setdefault("event_id", f"evt_{uuid.uuid4().hex}")
    last = events[-1]["event_id"]
    ours = {e["event_id"] for e in events}
    headers = {"Authorization": f"Bearer {s.openai_api_key}"}
    continues = events[-1]["type"] == "response.create"
    try:
        async with websockets.connect(
            SIDEBAND_URL.format(session_id), additional_headers=headers, open_timeout=5, close_timeout=0.3
        ) as ws:
            for event in events:
                await ws.send(json.dumps(event))
            await _wait_for_ack(ws, last, ours, continues=continues)
    except LiveError:
        raise
    except Exception as e:
        raise (SessionGone if _gone(e) else LiveError)("sideband failed") from e


async def alive(s: Settings, session_id: str) -> bool:
    """Whether OpenAI still runs the session (an attach is refused with 404 once it is over). Unsure counts as alive."""
    headers = {"Authorization": f"Bearer {s.openai_api_key}"}
    try:
        async with websockets.connect(
            SIDEBAND_URL.format(session_id), additional_headers=headers, open_timeout=5, close_timeout=1
        ):
            return True
    except Exception as e:
        return not _gone(e)


async def _wait_for_ack(ws: Any, last: str, ours: set[str], *, continues: bool) -> None:
    """Until Live has taken the events, or refused one.

    An append is acknowledged by an event carrying our `event_id` as `client_event_id`. A `response.create` is not:
    its proof is the backend starting a new response (checked live). The attach first replays the last few seconds,
    which may hold the *asking* response's `response.created`, but that one is followed at once by its own
    `response.completed`; a `response.created` still open after `_FRESH_SECONDS` is ours.
    """
    started: dict[str, float] = {}
    loop = asyncio.get_running_loop()
    try:
        async with asyncio.timeout(ACK_TIMEOUT_SECONDS):
            async for raw in ws:
                data = json.loads(raw)
                about = data.get("client_event_id") or (data.get("error") or {}).get("event_id")
                if data.get("type") == "error" and about in ours:
                    raise LiveError(f"Live refused an event: {(data.get('error') or {}).get('code')}")
                if about == last:
                    return
                if not continues:
                    continue
                if data.get("type") == "response.event":
                    nested = data.get("event") or {}
                    response_id = (nested.get("response") or {}).get("id")
                    if nested.get("type") == "response.created" and response_id:
                        started[response_id] = loop.time()
                    elif nested.get("type") in ("response.completed", "response.failed", "response.incomplete"):
                        started.pop(response_id, None)
                if any(loop.time() - at >= _FRESH_SECONDS for at in started.values()):
                    return
    except TimeoutError:
        log.info("voice sideband: no acknowledgement in time (sent anyway)")


async def hang_up(s: Settings, session_id: str) -> None:
    """End the session; one OpenAI no longer knows is already over."""
    client = AsyncOpenAI(api_key=s.openai_api_key, timeout=5, max_retries=2)
    try:
        await client.live.sessions.hangup(session_id)
    except NotFoundError:
        pass
    except Exception as e:
        raise LiveError("hang up failed") from e
