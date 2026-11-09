import hashlib
import hmac
import re
import secrets

from app.core.errors import error


def issue() -> str:
    return secrets.token_urlsafe(32)  # 43 URL-safe chars, no padding


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def equal(a: str | None, b: str | None) -> bool:
    return a is not None and b is not None and hmac.compare_digest(a.encode(), b.encode())


def bearer_hash(header: str | None) -> str:
    if header is None or not re.fullmatch(r"Bearer [A-Za-z0-9_-]{43}", header):
        raise error(401, "A valid bearer token is required.")
    return hash_token(header[7:])
