import threading
import time
from collections.abc import Callable

from starlette.requests import Request


def client_ip(request: Request, header: str) -> str:
    """The caller's IP: from `header` when a trusted proxy sets it (CLIENT_IP_HEADER), else the TCP peer."""
    if header and (value := request.headers.get(header)):
        return value.split(",")[0].strip()[:64]
    return request.client.host if request.client else "unknown"


class IpRateLimiter:
    """Fixed-window per-IP counter with bounded memory. Per-process; use a gateway for multi-instance."""

    def __init__(
        self,
        requests: int,
        window_seconds: float,
        max_clients: int,
        ticker: Callable[[], float] = time.monotonic,
    ) -> None:
        if requests < 1 or max_clients < 1 or window_seconds <= 0:
            raise ValueError("Rate limit settings must be positive.")
        self.requests, self.window, self.max_clients, self.ticker = requests, window_seconds, max_clients, ticker
        self._clients: dict[str, list[float | int]] = {}
        self._last_sweep = ticker()
        self._lock = threading.Lock()

    def allow(self, ip: str) -> bool:
        with self._lock:
            now = self.ticker()
            if now - self._last_sweep >= self.window:
                self._clients = {k: v for k, v in self._clients.items() if now - v[0] < self.window}
                self._last_sweep = now
            bucket = self._clients.get(ip)
            if bucket is None or now - bucket[0] >= self.window:
                if bucket is None and len(self._clients) >= self.max_clients:
                    return False
                bucket = [now, 0]
                self._clients[ip] = bucket
            if bucket[1] >= self.requests:
                return False
            bucket[1] += 1
            return True
