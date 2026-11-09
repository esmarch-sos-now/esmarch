"""Public API policy: no-store caching, HTTPS enforcement, HSTS and per-IP rate limiting.

Pure ASGI so it also covers 404/405 responses. Client IP and scheme come from scope, which uvicorn only
rewrites from X-Forwarded-* when the peer is in --forwarded-allow-ips; raw headers are never trusted here.
"""

import math

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.errors import problem
from app.core.ratelimit import IpRateLimiter


class PublicApiMiddleware:
    def __init__(
        self, app: ASGIApp, *, require_https: bool, requests: int, window_seconds: float, max_clients: int
    ) -> None:
        self.app = app
        self.require_https = require_https
        self.window = window_seconds
        self.limiter = IpRateLimiter(requests, window_seconds, max_clients)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        path = scope.get("path", "")
        if scope["type"] != "http" or not path.startswith("/api/"):
            await self.app(scope, receive, send)
            return

        secure = scope.get("scheme") in ("https", "wss")
        base = {"Cache-Control": "no-store", "Pragma": "no-cache"}

        async def respond(status: int, detail: str, extra: dict[str, str] | None = None) -> None:
            response = problem(status, detail, {**base, **(extra or {})})
            await response(scope, receive, send)

        if self.require_https and not secure:
            return await respond(426, "HTTPS is required.")

        headers = dict(base)
        if secure:
            headers["Strict-Transport-Security"] = "max-age=31536000"

        limited = path != "/api/health" and path != "/api/alerts" and not path.startswith("/api/alerts/")
        if limited and scope["method"] != "OPTIONS":
            client = scope.get("client")
            ip = client[0] if client else "unknown"
            if not self.limiter.allow(ip):
                retry = str(max(1, math.floor(self.window) + 1))
                return await respond(429, "Too many requests. Please retry later.", {**headers, "Retry-After": retry})

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                existing = {k.lower() for k, _ in message.get("headers", [])}
                raw = list(message.get("headers", []))
                for name, value in headers.items():
                    if name.lower().encode() not in existing:
                        raw.append((name.lower().encode(), value.encode()))
                message["headers"] = raw
            await send(message)

        await self.app(scope, receive, send_with_headers)
