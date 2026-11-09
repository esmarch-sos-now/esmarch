"""`/api/voice/ws`: the browser's realtime voice channel (see `app.voice.call` for the message protocol).

Guards, because every call holds a paid upstream connection and is reachable from the public internet: an exact
`Origin` match against the configured frontends, a per-IP connect rate limit, a cap on concurrent calls, an
explicit consent message before any audio is accepted, and a hard time limit per call.

A call survives a dropped WebSocket for a grace period: the browser reconnects here and opens with `resume` (instead of
`start`) and the `callId` it was given (`app.voice.resume`). That is the same call, so it is not counted again.
"""

import asyncio
import logging
import secrets
from functools import lru_cache
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.core.config import get_settings
from app.core.ratelimit import IpRateLimiter
from app.voice.call import build_model, live_settings, parse_text, run_call
from app.voice.resume import ResumableTransport, registry

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/voice", tags=["voice"])

START_TIMEOUT_SECONDS = 10.0
_active_calls = 0


@lru_cache
def _limiter() -> IpRateLimiter:
    s = get_settings()
    return IpRateLimiter(s.voice_connects_per_window, s.public_api_rate_limit_window_seconds, s.public_api_max_clients)


class _SocketTransport:
    def __init__(self, ws: WebSocket) -> None:
        self._ws = ws

    async def send_json(self, data: dict[str, Any]) -> None:
        await self._ws.send_json(data)

    async def receive(self) -> dict[str, Any] | None:
        while True:
            try:
                message = await self._ws.receive()
            except WebSocketDisconnect, RuntimeError:
                return None
            if message["type"] == "websocket.disconnect":
                return None
            if (data := parse_text(message.get("text") or "")) is not None:
                return data

    async def close(self, code: int = 1000, reason: str = "") -> None:
        try:
            await self._ws.close(code=code, reason=reason)
        except RuntimeError, WebSocketDisconnect:
            pass  # already closed


async def _reject(ws: WebSocket, code: int, reason: str) -> None:
    await ws.close(code=code, reason=reason)


async def _first_message(transport: _SocketTransport) -> dict[str, Any] | None:
    try:
        return await asyncio.wait_for(transport.receive(), START_TIMEOUT_SECONDS)
    except TimeoutError:
        return None


@router.websocket("/ws")
async def voice(ws: WebSocket) -> None:
    global _active_calls
    s = get_settings()
    if not s.voice_configured:
        return await _reject(ws, status.WS_1013_TRY_AGAIN_LATER, "voice unavailable")
    # Rate limit first: `Origin` is trivially forged outside a browser, so the per-IP budget (and the call cap below)
    # is the real protection and must also count probes that fail the origin check.
    ip = ws.client.host if ws.client else "unknown"
    if not _limiter().allow(ip):
        return await _reject(ws, status.WS_1013_TRY_AGAIN_LATER, "too many requests")
    # Browsers always send Origin on a WebSocket handshake; this stops other websites' pages from using ours.
    if ws.headers.get("origin") not in s.origins:
        return await _reject(ws, status.WS_1008_POLICY_VIOLATION, "origin not allowed")
    # A full house still lets a resume in (it is an existing call), but only when some call is waiting for one.
    if _active_calls >= s.voice_max_sessions and not registry.any_detached():
        return await _reject(ws, status.WS_1013_TRY_AGAIN_LATER, "busy")

    await ws.accept()
    socket = _SocketTransport(ws)
    first = await _first_message(socket)
    if isinstance(first, dict) and first.get("type") == "resume":
        return await _resume(ws, socket, first.get("callId"))
    if _active_calls >= s.voice_max_sessions:
        return await _reject(ws, status.WS_1013_TRY_AGAIN_LATER, "busy")
    if not isinstance(first, dict) or first.get("type") != "start" or first.get("consent") is not True:
        return await _reject(ws, status.WS_1008_POLICY_VIOLATION, "consent required")

    _active_calls += 1
    call_id = secrets.token_urlsafe(32)  # the resume credential: never logged
    transport = ResumableTransport(socket, grace_seconds=s.voice_resume_grace_seconds)
    registry.add(call_id, transport)  # per-process: a resume must reach the worker that holds the call
    reason = "error"
    try:
        reason = await run_call(
            transport,
            build_model(s),
            duration_seconds=s.voice_session_seconds,
            settings=live_settings(s),
            checkin_seconds=s.voice_checkin_seconds,
            checkin_max=s.voice_checkin_max,
            end_warning_seconds=s.voice_end_warning_seconds,
            call_id=call_id,
        )
    except Exception:
        log.exception("voice call failed")
    finally:
        # Free the slot before the await below: a cancellation there must not leak it.
        _active_calls -= 1
        registry.remove(call_id)
        await transport.finish(reason)


async def _resume(ws: WebSocket, socket: _SocketTransport, call_id: object) -> None:
    """Hand this socket to the call it names, then wait until it is no longer the call's socket."""
    transport = registry.get(call_id)
    released = await transport.attach(socket) if transport is not None else None
    if released is None:
        return await _reject(ws, 4404, "unknown call")
    await released.wait()
