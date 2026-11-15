"""The two Supabase services the backend calls with its service key: Storage (request photos) and Realtime.

Both are plain HTTPS, so nothing here needs a long-lived connection. Without `SUPABASE_SERVICE_KEY` (local dev,
tests) photos go to a per-process memory store and realtime signals are dropped; clients then rely on polling.
"""

import logging
from typing import Protocol

import httpx

from app.core.config import get_settings

log = logging.getLogger(__name__)
TIMEOUT = httpx.Timeout(3.0, connect=2.0)


class Storage(Protocol):
    def put(self, path: str, data: bytes, content_type: str) -> None: ...
    def get(self, path: str) -> bytes: ...
    def delete(self, paths: list[str]) -> None: ...


class MemoryStorage:
    """Dev/test stand-in. Lost on restart, not shared between instances: never used when a service key is set."""

    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    def put(self, path: str, data: bytes, content_type: str) -> None:
        self.objects[path] = data

    def get(self, path: str) -> bytes:
        return self.objects[path]

    def delete(self, paths: list[str]) -> None:
        for p in paths:
            self.objects.pop(p, None)


class SupabaseStorage:
    def __init__(self, url: str, key: str, bucket: str) -> None:
        self.base = f"{url.rstrip('/')}/storage/v1"
        self.bucket = bucket
        self.headers = {"Authorization": f"Bearer {key}", "apikey": key}

    def put(self, path: str, data: bytes, content_type: str) -> None:
        r = httpx.post(
            f"{self.base}/object/{self.bucket}/{path}",
            content=data,
            headers={**self.headers, "Content-Type": content_type, "x-upsert": "true"},
            timeout=TIMEOUT,
        )
        r.raise_for_status()

    def get(self, path: str) -> bytes:
        r = httpx.get(f"{self.base}/object/authenticated/{self.bucket}/{path}", headers=self.headers, timeout=TIMEOUT)
        r.raise_for_status()
        return r.content

    def delete(self, paths: list[str]) -> None:
        if not paths:
            return
        r = httpx.request(
            "DELETE",
            f"{self.base}/object/{self.bucket}",
            json={"prefixes": paths},
            headers=self.headers,
            timeout=TIMEOUT,
        )
        r.raise_for_status()


_memory = MemoryStorage()


def get_storage() -> Storage:
    s = get_settings()
    if s.supabase_service_key and s.supabase_url:
        return SupabaseStorage(s.supabase_url, s.supabase_service_key, s.supabase_photo_bucket)
    return _memory


def broadcast(topics: list[tuple[str, dict]]) -> None:
    """Send Realtime Broadcast messages (topic, payload). The payload is only ever a "something changed" signal:
    clients refetch over authenticated HTTP, so nothing personal travels on a channel. Failures are logged, not raised:
    the HTTP state is the truth and clients also poll."""
    s = get_settings()
    if not topics or not (s.supabase_service_key and s.supabase_url):
        return
    body = {"messages": [{"topic": t, "event": "changed", "payload": p, "private": False} for t, p in topics]}
    try:
        httpx.post(
            f"{s.supabase_url.rstrip('/')}/realtime/v1/api/broadcast",
            json=body,
            headers={"apikey": s.supabase_service_key, "Authorization": f"Bearer {s.supabase_service_key}"},
            timeout=TIMEOUT,
        ).raise_for_status()
    except httpx.HTTPError:
        log.warning("realtime broadcast failed", exc_info=True)


class AuthAdminError(Exception):
    """Supabase Auth's admin API refused or could not be reached."""


def update_auth_user(user_id: str, attributes: dict) -> bool:
    """Change a Supabase Auth user with the service key (`PUT /auth/v1/admin/users/{id}`), e.g. to ban it or to put
    its role in `app_metadata` (which only the service key can write). False when no service key is configured."""
    s = get_settings()
    if not (s.supabase_service_key and s.supabase_url):
        return False
    try:
        httpx.put(
            f"{s.supabase_url.rstrip('/')}/auth/v1/admin/users/{user_id}",
            json=attributes,
            headers={"apikey": s.supabase_service_key, "Authorization": f"Bearer {s.supabase_service_key}"},
            timeout=TIMEOUT,
        ).raise_for_status()
    except httpx.HTTPError as e:
        raise AuthAdminError("Supabase Auth admin request failed") from e
    return True
