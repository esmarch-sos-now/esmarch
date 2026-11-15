"""Validates Supabase Auth access tokens (https://supabase.com/docs/guides/auth/jwts).

Supabase signs access tokens with the project's asymmetric signing key (ES256 by default, RS256 possible). The
public keys are published at `<SUPABASE_URL>/auth/v1/.well-known/jwks.json`; the token header's `kid` picks one.
Symmetric (HS256) tokens are never accepted, so the legacy shared JWT secret is not needed here.
"""

from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import jwt
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientConnectionError, PyJWTError

from app.core.config import get_settings
from app.core.errors import error

ALGORITHMS = ["ES256", "RS256"]
AUDIENCE = "authenticated"  # signed-in users; anonymous and service tokens carry other audiences or roles
# Supabase's own caches hold the key set for up to 20 minutes; the docs ask clients not to cache longer.
JWKS_CACHE_SECONDS = 600
LEEWAY_SECONDS = 10  # clock skew between Supabase and this server


@dataclass(frozen=True)
class AuthUser:
    """The signed-in Supabase user, built from the verified access token's claims."""

    id: str  # Supabase `auth.users.id` (a UUID), the `sub` claim
    phone: str | None  # E.164 with "+", e.g. +84912345678; accounts sign in with phone number + password
    email: str | None
    display_name: str | None


@lru_cache
def _jwks(url: str) -> PyJWKClient:
    return PyJWKClient(url, cache_jwk_set=True, lifespan=JWKS_CACHE_SECONDS, timeout=5)


def signing_key(token: str) -> Any:
    """Public key for the token's `kid`. PyJWKClient refetches the key set once when the `kid` is unknown."""
    return _jwks(get_settings().supabase_jwks_url).get_signing_key_from_jwt(token).key


def _display_name(metadata: object) -> str | None:
    if not isinstance(metadata, dict):
        return None
    for key in ("display_name", "full_name", "name"):
        value = metadata.get(key)
        if isinstance(value, str) and value.strip():
            return " ".join(value.split())[:100]
    return None


def verify_access_token(token: str) -> AuthUser | None:
    """Returns the user for a valid access token of this project, or None for any invalid, expired or foreign one.

    Raises 503 when the key set cannot be fetched, so an outage is not reported as "signed out".
    """
    s = get_settings()
    try:
        claims = jwt.decode(
            token,
            signing_key(token),
            algorithms=ALGORITHMS,
            audience=AUDIENCE,
            issuer=s.supabase_issuer,
            leeway=LEEWAY_SECONDS,
            options={"require": ["exp", "iat", "iss", "aud", "sub", "role"]},
        )
    except PyJWKClientConnectionError:
        raise error(503, "Authentication service is unavailable.") from None
    except PyJWTError:
        return None
    sub = claims.get("sub")
    if claims.get("role") != "authenticated" or claims.get("is_anonymous") is True or not isinstance(sub, str):
        return None
    email, phone = claims.get("email"), claims.get("phone")
    return AuthUser(
        id=sub,
        phone=f"+{phone.lstrip('+')}" if isinstance(phone, str) and phone else None,  # Supabase omits the "+"
        email=email if isinstance(email, str) and email else None,
        display_name=_display_name(claims.get("user_metadata")),
    )
