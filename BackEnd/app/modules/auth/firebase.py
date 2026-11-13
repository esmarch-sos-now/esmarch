"""Checks Firebase Phone Auth ID tokens, following
https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library.

The browser runs the SMS OTP with the Firebase JS SDK and sends us the ID token it gets back. The token is an RS256 JWT
signed by Google's securetoken keys; we only trust the phone number inside it after checking the signature, audience,
issuer, expiry and that the OTP was entered recently.
"""

import threading

import jwt
from jwt import PyJWKClient
from jwt.exceptions import InvalidTokenError, PyJWKClientConnectionError, PyJWKClientError

from app.core import clock
from app.core.config import get_settings

JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
LEEWAY_SECONDS = 60  # clock skew between Google and us

_lock = threading.Lock()
_jwks: PyJWKClient | None = None


def _client() -> PyJWKClient:
    global _jwks
    with _lock:
        if _jwks is None:
            _jwks = PyJWKClient(JWKS_URL, cache_keys=True, lifespan=3600, timeout=10)
        return _jwks


class FirebaseUnavailable(Exception):
    """Google's signing keys could not be fetched."""


def verified_phone(id_token: str) -> str | None:
    """Returns the E.164 phone number proven by a fresh Firebase phone sign-in, or None for any invalid token."""
    s = get_settings()
    project = s.firebase_project_id
    try:
        key = _client().get_signing_key_from_jwt(id_token)
    except PyJWKClientConnectionError as exc:
        raise FirebaseUnavailable from exc
    except PyJWKClientError, InvalidTokenError:  # unknown key id, or not a JWT at all
        return None
    try:
        claims = jwt.decode(
            id_token,
            key.key,
            algorithms=["RS256"],
            audience=project,
            issuer=f"https://securetoken.google.com/{project}",
            leeway=LEEWAY_SECONDS,
            options={"require": ["exp", "iat", "sub", "auth_time"]},
        )
    except InvalidTokenError:
        return None
    phone = claims.get("phone_number")
    provider = (claims.get("firebase") or {}).get("sign_in_provider")
    auth_time = claims.get("auth_time")
    if not isinstance(phone, str) or provider != "phone" or not isinstance(auth_time, int | float):
        return None
    age = clock.now().timestamp() - auth_time
    if age > s.phone_otp_max_age_seconds or age < -LEEWAY_SECONDS:
        return None
    return phone
