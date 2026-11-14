"""Password hashing, JWT access tokens and one-time codes.

Follows https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/: PyJWT (HS256) and pwdlib's recommended Argon2
hasher, with a dummy-hash check for unknown accounts so response time does not reveal which emails exist.
"""

import hashlib
import hmac
import re
import secrets
from datetime import timedelta

import jwt
from email_validator import EmailNotValidError, validate_email
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash

from app.core import clock
from app.core.config import get_settings

ALGORITHM = "HS256"
ISSUER = "esmarch"
AUDIENCE = "esmarch-api"

password_hash = PasswordHash.recommended()
DUMMY_HASH = password_hash.hash("dummypassword")


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed: str | None) -> tuple[bool, str | None]:
    """Returns (valid, new hash when the stored one uses outdated parameters)."""
    if hashed is None:
        password_hash.verify(password, DUMMY_HASH)
        return False, None
    return password_hash.verify_and_update(password, hashed)


def normalize_email(value: str) -> str | None:
    try:
        return validate_email(value.strip(), check_deliverability=False).normalized.lower()
    except EmailNotValidError:
        return None


_VN_MOBILE = re.compile(r"\+84[35789]\d{8}")


def normalize_phone(value: str) -> str | None:
    """Vietnamese mobile number to E.164: accepts 0912 345 678, 84912345678 or +84 912-345-678."""
    digits = re.sub(r"[\s.()-]", "", value)
    if digits.startswith("0"):
        digits = "+84" + digits[1:]
    elif digits.startswith("84"):
        digits = "+" + digits
    return digits if _VN_MOBILE.fullmatch(digits) else None


def create_access_token(user_id: str, role: str = "USER") -> tuple[str, int]:
    """`role` is a routing hint for the Next.js proxy (admins stay in /admin); the API always checks the database."""
    s = get_settings()
    now = clock.now()
    ttl = s.access_token_ttl_seconds
    claims = {
        "sub": user_id,
        "role": role,
        "iss": ISSUER,
        "aud": AUDIENCE,
        "iat": now,
        "exp": now + timedelta(seconds=ttl),
        "jti": secrets.token_urlsafe(8),
    }
    return jwt.encode(claims, s.auth_secret_key, algorithm=ALGORITHM), ttl


def decode_access_token(token: str) -> str | None:
    """Returns the user id, or None for any invalid, expired or foreign token.

    Expiry is checked against app.core.clock (not PyJWT's wall clock) so tests can move time.
    """
    try:
        payload = jwt.decode(
            token,
            get_settings().auth_secret_key,
            algorithms=[ALGORITHM],
            audience=AUDIENCE,
            issuer=ISSUER,
            options={"require": ["sub", "exp", "iat"], "verify_exp": False, "verify_iat": False},
        )
    except InvalidTokenError:
        return None
    exp, sub = payload.get("exp"), payload.get("sub")
    if not isinstance(exp, int | float) or exp <= clock.now().timestamp() or not isinstance(sub, str):
        return None
    return sub


def new_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def code_digest(user_id: str, purpose: str, code: str) -> str:
    key = get_settings().auth_secret_key.encode()
    return hmac.new(key, f"{purpose}:{user_id}:{code}".encode(), hashlib.sha256).hexdigest()
