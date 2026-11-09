"""`/api/voice/ws`: the browser's realtime voice channel (see `app.voice.call` for the message protocol).

Guards, because every call holds a paid upstream connection and is reachable from the public internet: an exact
`Origin` match against the configured frontends, a per-IP connect rate limit, a cap on concurrent calls, an
explicit consent message before any audio is accepted, and a hard time limit per call.
"""

import asyncio
import logging
from functools import lru_cache
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.core.config import get_settings
from app.core.ratelimit import IpRateLimiter
from app.voice.call import build_model, live_settings, parse_text, run_call

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


async def _reject(ws: WebSocket, code: int, reason: str) -> None:
    await ws.close(code=code, reason=reason)


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
    if _active_calls >= s.voice_max_sessions:
        return await _reject(ws, status.WS_1013_TRY_AGAIN_LATER, "busy")

    _active_calls += 1
    try:
        await ws.accept()
        transport = _SocketTransport(ws)
        try:
            start = await asyncio.wait_for(transport.receive(), START_TIMEOUT_SECONDS)
        except TimeoutError:
            start = None
        if not isinstance(start, dict) or start.get("type") != "start" or start.get("consent") is not True:
            return await _reject(ws, status.WS_1008_POLICY_VIOLATION, "consent required")

        model = build_model(s)
        reason = "error"
        try:
            reason = await run_call(
                transport,
                model,
                duration_seconds=s.voice_session_seconds,
                settings=live_settings(s),
                checkin_seconds=s.voice_checkin_seconds,
                checkin_max=s.voice_checkin_max,
            )
        except Exception:
            log.exception("voice call failed")
        try:
            await ws.send_json({"type": "ended", "reason": reason})
            await ws.close()
        except RuntimeError, WebSocketDisconnect:
            pass  # the browser is already gone
    finally:
        _active_calls -= 1
