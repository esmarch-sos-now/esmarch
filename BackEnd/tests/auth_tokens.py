"""Supabase-shaped access tokens for tests, signed with a throwaway P-256 key (conftest swaps it in for the JWKS)."""

import time
import uuid
from typing import Any

import jwt
from cryptography.hazmat.primitives.asymmetric import ec

ISSUER = "https://test-project.supabase.co/auth/v1"  # matches SUPABASE_URL in conftest
_PRIVATE_KEY = ec.generate_private_key(ec.SECP256R1())
PUBLIC_KEY = _PRIVATE_KEY.public_key()


def claims(
    user_id: str | None = None,
    phone: str = "84912345678",  # Supabase puts the number in the token without the "+"
    email: str = "",
    name: str | None = "An",
    **overrides,
) -> dict:
    now = int(time.time())
    base: dict[str, Any] = {
        "iss": ISSUER,
        "aud": "authenticated",
        "sub": user_id or str(uuid.uuid4()),
        "exp": now + 3600,
        "iat": now,
        "role": "authenticated",
        "aal": "aal1",
        "session_id": str(uuid.uuid4()),
        "email": email,
        "phone": phone,
        "is_anonymous": False,
        "user_metadata": {"display_name": name} if name else {},
        "app_metadata": {"provider": "phone"},
    }
    base.update(overrides)
    return base


def token(key: Any = None, algorithm: str = "ES256", **claim_overrides) -> str:
    return jwt.encode(claims(**claim_overrides), key or _PRIVATE_KEY, algorithm=algorithm, headers={"kid": "test"})


def bearer(**claim_overrides) -> dict:
    return {"Authorization": f"Bearer {token(**claim_overrides)}"}
