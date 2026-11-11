"""`/api/support/ws`: live channel for "Tìm kiếm người hỗ trợ" (responders and requesters).

The browser connects straight to the backend (like `/api/voice/ws`; a Next rewrite is not reliable for WebSockets).
Guards: an exact `Origin` match against the configured frontends, a per-IP connect rate limit and a `hello` message
within 10 s that authenticates the socket:

- responder: `{"type": "hello", "role": "responder", "ticket": "<one-time ticket>"}`. The ticket comes from
  `POST /api/support/ws-ticket` (signed-in user, through the Next proxy), lives 30 s and works once, so the account
  token itself never travels in a WebSocket URL or message.
- requester: `{"type": "hello", "role": "requester", "requestId": "...", "token": "<requesterToken>"}`.

Client -> server (responder): ping, available {latitude, longitude}, unavailable, location {latitude, longitude},
accept {requestId}, decline {requestId}, complete {requestId}. Requester: ping, cancel.
Server -> client: pong, ready, availability, request.new, request.detail, request.taken, request.cancelled,
request.expired (responders); request.state, request.invited, request.accepted, responder.location,
request.completed, request.expired (requesters); error {message, requestId?}.

The hub only delivers. All state and privacy rules live in `SupportService`, which calls `hub.publish` (possibly from a
worker thread: HTTP handlers run there) whenever something changes. A responder whose last socket drops stays available
for SUPPORT_OFFLINE_GRACE_SECONDS so a page reload or a short network gap does not take them offline.
"""

import asyncio
import contextlib
import logging
import threading
import time
from collections import defaultdict
from functools import lru_cache
from typing import Any

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlmodel import Session

from app.common import tokens
from app.core.config import get_settings
from app.core.db import get_engine
from app.core.ratelimit import IpRateLimiter
from app.modules.auth.models import User
from app.modules.support.models import Responder
from app.modules.support.service import support

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/support", tags=["support"])

HELLO_TIMEOUT_SECONDS = 10.0
TICKET_TTL_SECONDS = 30.0


class Hub:
    def __init__(self) -> None:
        self.loop: asyncio.AbstractEventLoop | None = None
        self.sockets: dict[tuple[str, str], set[WebSocket]] = defaultdict(set)
        self.tickets: dict[str, tuple[str, float]] = {}  # ticket hash -> (user id, expiry on the monotonic clock)
        self.ticket_lock = threading.Lock()
        self.offline: dict[str, asyncio.Task[None]] = {}

    # ---- delivery -----------------------------------------------------------------------------
    def publish(self, kind: str, target: str, message: dict[str, Any]) -> None:
        """Thread-safe: queue a message for every socket of ("responder", id) or ("request", id)."""
        loop = self.loop
        if loop is None or loop.is_closed():
            return
        with contextlib.suppress(RuntimeError):  # loop shutting down
            loop.call_soon_threadsafe(self._fanout, kind, target, message)

    def _fanout(self, kind: str, target: str, message: dict[str, Any]) -> None:
        for ws in list(self.sockets.get((kind, target), ())):
            asyncio.ensure_future(send(ws, message))

    def add(self, kind: str, target: str, ws: WebSocket) -> None:
        self.sockets[(kind, target)].add(ws)
        if kind == "responder" and (task := self.offline.pop(target, None)):
            task.cancel()

    def remove(self, kind: str, target: str, ws: WebSocket) -> None:
        group = self.sockets.get((kind, target))
        if group is not None:
            group.discard(ws)
            if not group:
                del self.sockets[(kind, target)]
        if kind == "responder" and (kind, target) not in self.sockets:
            self.offline[target] = asyncio.ensure_future(self._go_offline(target))

    async def _go_offline(self, responder_id: str) -> None:
        try:
            await asyncio.sleep(get_settings().support_offline_grace_seconds)
        except asyncio.CancelledError:
            return
        self.offline.pop(responder_id, None)
        if ("responder", responder_id) not in self.sockets:
            support.go_unavailable(responder_id)

    # ---- one-time tickets for signed-in responders ---------------------------------------------
    def issue_ticket(self, user_id: str) -> str:
        """Called from HTTP worker threads; `redeem` runs on the event loop, hence the lock."""
        with self.ticket_lock:
            now = time.monotonic()
            for k in [k for k, (_, exp) in self.tickets.items() if exp <= now]:
                del self.tickets[k]
            if len(self.tickets) >= 10_000:
                raise HTTPException(503, "Too many pending connections.")
            ticket = tokens.issue()
            self.tickets[tokens.hash_token(ticket)] = (user_id, now + TICKET_TTL_SECONDS)
            return ticket

    def redeem(self, ticket: object) -> str | None:
        if not isinstance(ticket, str) or len(ticket) > 100:
            return None
        with self.ticket_lock:
            entry = self.tickets.pop(tokens.hash_token(ticket), None)
        if entry is None or entry[1] <= time.monotonic():
            return None
        return entry[0]


hub = Hub()


@lru_cache
def _limiter() -> IpRateLimiter:
    s = get_settings()
    return IpRateLimiter(
        s.support_ws_connects_per_window, s.public_api_rate_limit_window_seconds, s.public_api_max_clients
    )


async def send(ws: WebSocket, message: dict[str, Any]) -> None:
    # A closed socket raises here; its receive loop removes it from the hub.
    with contextlib.suppress(Exception):
        await ws.send_json(jsonable(message))


def jsonable(value: Any) -> Any:
    from fastapi.encoders import jsonable_encoder

    return jsonable_encoder(value)


async def _receive(ws: WebSocket, timeout: float | None = None) -> dict[str, Any] | None:
    try:
        message = await asyncio.wait_for(ws.receive_json(), timeout) if timeout else await ws.receive_json()
    except WebSocketDisconnect, RuntimeError, ValueError, TimeoutError:
        return None
    return message if isinstance(message, dict) else {}


def _number(message: dict[str, Any], key: str) -> float:
    value = message.get(key)
    if not isinstance(value, int | float) or isinstance(value, bool):
        raise HTTPException(400, "Invalid coordinates.")
    return float(value)


def _request_id(message: dict[str, Any]) -> str:
    value = message.get("requestId")
    if not isinstance(value, str) or not 0 < len(value) <= 64:
        raise HTTPException(400, "Invalid request id.")
    return value


def _load_profile(user_id: str) -> Responder | None:
    with Session(get_engine()) as session:
        user = session.get(User, user_id)
        if user is None or not user.is_active:
            return None
        try:
            return support.profile_for_user(session, user)
        except HTTPException:
            return None


def _requester_state(requester_token: object, request_id: object) -> dict[str, Any] | None:
    if not isinstance(requester_token, str) or not isinstance(request_id, str):
        return None
    try:
        ticket = support.owned(f"Bearer {requester_token}", request_id)
        with Session(get_engine()) as session:
            return support.requester_state(session, ticket)
    except HTTPException:
        return None


@router.websocket("/ws")
async def support_ws(ws: WebSocket) -> None:
    s = get_settings()
    hub.loop = asyncio.get_running_loop()
    ip = ws.client.host if ws.client else "unknown"
    if not _limiter().allow(ip):
        return await ws.close(code=status.WS_1013_TRY_AGAIN_LATER, reason="too many requests")
    if ws.headers.get("origin") not in s.origins:
        return await ws.close(code=status.WS_1008_POLICY_VIOLATION, reason="origin not allowed")
    await ws.accept()
    hello = await _receive(ws, HELLO_TIMEOUT_SECONDS)
    if not hello or hello.get("type") != "hello":
        return await ws.close(code=status.WS_1008_POLICY_VIOLATION, reason="hello required")

    if hello.get("role") == "responder":
        user_id = hub.redeem(hello.get("ticket"))
        profile = await asyncio.to_thread(_load_profile, user_id) if user_id else None
        if profile is None:
            return await ws.close(code=status.WS_1008_POLICY_VIOLATION, reason="not a responder")
        await _responder_session(ws, profile)
    elif hello.get("role") == "requester":
        request_id = hello.get("requestId")
        state = await asyncio.to_thread(_requester_state, hello.get("token"), request_id)
        if state is None or not isinstance(request_id, str):
            return await ws.close(code=status.WS_1008_POLICY_VIOLATION, reason="invalid request")
        await _requester_session(ws, request_id, str(hello.get("token")), state)
    else:
        await ws.close(code=status.WS_1008_POLICY_VIOLATION, reason="unknown role")


async def _responder_session(ws: WebSocket, profile: Responder) -> None:
    hub.add("responder", profile.id, ws)
    try:
        await send(
            ws,
            {
                "type": "ready",
                "role": "responder",
                "available": profile.id in support.presence,
                "requests": await asyncio.to_thread(support.requests_for, profile),
            },
        )
        while (message := await _receive(ws)) is not None:
            kind = message.get("type")
            try:
                if kind == "ping":
                    await send(ws, {"type": "pong"})
                elif kind == "available":
                    lat, lng = _number(message, "latitude"), _number(message, "longitude")
                    result = await asyncio.to_thread(support.go_available, profile, lat, lng)
                    await send(ws, {"type": "availability", **result})
                elif kind == "unavailable":
                    await send(ws, {"type": "availability", **support.go_unavailable(profile.id)})
                elif kind == "location":
                    lat, lng = _number(message, "latitude"), _number(message, "longitude")
                    await asyncio.to_thread(support.update_location, profile.id, lat, lng)
                elif kind == "accept":
                    detail = await asyncio.to_thread(support.accept_for, profile, _request_id(message))
                    await send(ws, {"type": "request.detail", "request": detail})
                elif kind == "decline":
                    await asyncio.to_thread(support.decline_for, profile.id, _request_id(message))
                elif kind == "complete":
                    request_id = _request_id(message)
                    await asyncio.to_thread(support.complete_for, profile.id, request_id)
                    await send(ws, {"type": "request.completed", "requestId": request_id})
                elif kind == "sync":
                    await send(
                        ws,
                        {
                            "type": "ready",
                            "role": "responder",
                            "available": profile.id in support.presence,
                            "requests": await asyncio.to_thread(support.requests_for, profile),
                        },
                    )
            except HTTPException as exc:
                await send(ws, {"type": "error", "message": exc.detail, "requestId": message.get("requestId")})
    finally:
        hub.remove("responder", profile.id, ws)


async def _requester_session(ws: WebSocket, request_id: str, token: str, state: dict[str, Any]) -> None:
    hub.add("request", request_id, ws)
    try:
        await send(ws, {"type": "request.state", "request": state})
        while (message := await _receive(ws)) is not None:
            kind = message.get("type")
            try:
                if kind == "ping":
                    await send(ws, {"type": "pong"})
                elif kind == "sync":
                    current = await asyncio.to_thread(_requester_state, token, request_id)
                    if current is None:
                        await send(ws, {"type": "request.expired", "requestId": request_id})
                    else:
                        await send(ws, {"type": "request.state", "request": current})
                elif kind == "cancel":
                    await asyncio.to_thread(support.cancel, f"Bearer {token}", request_id)
                    await send(ws, {"type": "request.cancelled", "requestId": request_id})
            except HTTPException as exc:
                await send(ws, {"type": "error", "message": exc.detail, "requestId": request_id})
    finally:
        hub.remove("request", request_id, ws)


support.notify = hub.publish
