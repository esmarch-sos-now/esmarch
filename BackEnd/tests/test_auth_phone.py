"""Phone sign-up and password reset with Firebase SMS OTP ID tokens, signed here with a test RSA key."""

import time
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.modules.auth import firebase

PROJECT = "sos-esmarch"  # matches FIREBASE_PROJECT_ID in conftest
PASSWORD = "correct horse battery"
PHONE = "+84912345678"

_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_other = rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(autouse=True)
def google_keys(monkeypatch):
    """Stands in for Google's JWKS endpoint with our test public key."""
    keys = SimpleNamespace(get_signing_key_from_jwt=lambda token: SimpleNamespace(key=_key.public_key()))
    monkeypatch.setattr(firebase, "_client", lambda: keys)


def id_token(phone=PHONE, *, key=_key, aud=PROJECT, provider="phone", auth_age=0, exp_in=3600) -> str:
    now = int(time.time())
    claims = {
        "iss": f"https://securetoken.google.com/{aud}",
        "aud": aud,
        "sub": "firebase-uid",
        "iat": now,
        "exp": now + exp_in,
        "auth_time": now - auth_age,
        "phone_number": phone,
        "firebase": {"sign_in_provider": provider, "identities": {"phone": [phone]}},
    }
    return jwt.encode(claims, key, algorithm="RS256", headers={"kid": "test"})


def register(client, token=None, password=PASSWORD, name=" Huyền  Trần "):
    body = {"idToken": token or id_token(), "password": password, "displayName": name}
    return client.post("/api/auth/phone/register", json=body)


def login(client, username="0912 345 678", password=PASSWORD):
    return client.post("/api/auth/token", data={"username": username, "password": password})


def test_register_signs_in_and_login_accepts_local_formats(client):
    r = register(client)
    assert r.status_code == 200
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {r.json()['access_token']}"}).json()
    assert me["phone"] == PHONE and me["phoneVerified"] is True
    assert me["email"] is None and me["displayName"] == "Huyền Trần"

    for username in ("0912345678", "+84 912 345 678", "84912345678", "0912.345.678"):
        assert login(client, username).status_code == 200, username
    assert login(client, password="wrong password").status_code == 401
    assert login(client, "0987654321").status_code == 401


def test_number_can_only_register_once(client):
    assert register(client).status_code == 200
    again = register(client)
    assert again.status_code == 409 and again.json()["detail"] == "Phone number already registered."


@pytest.mark.parametrize(
    "token",
    [
        id_token(key=_other),  # not signed by Google
        id_token(aud="someone-elses-project"),
        id_token(provider="password"),  # not an SMS sign-in
        id_token(auth_age=3600),  # OTP entered too long ago
        id_token(exp_in=-3600),  # expired
        id_token(phone="+14155550100"),  # not a Vietnamese mobile number
        "not-a-jwt-at-all-but-long-enough",
    ],
)
def test_bad_tokens_are_rejected(client, token):
    r = register(client, token)
    assert r.status_code == 400 and r.json()["detail"] == "Invalid or expired phone verification."
    assert login(client).status_code == 401


def test_reset_password_with_sms(client):
    tokens = register(client).json()
    r = client.post("/api/auth/phone/reset-password", json={"idToken": id_token(), "newPassword": "a brand new secret"})
    assert r.status_code == 204
    assert login(client).status_code == 401
    assert login(client, password="a brand new secret").status_code == 200
    # every earlier session was signed out
    assert client.post("/api/auth/refresh", json={"refreshToken": tokens["refresh_token"]}).status_code == 401


def test_reset_unknown_number(client):
    r = client.post("/api/auth/phone/reset-password", json={"idToken": id_token(), "newPassword": "a brand new secret"})
    assert r.status_code == 404


def test_short_password_rejected(client):
    assert register(client, password="short").status_code == 400


def test_not_configured(client, monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "firebase_project_id", "")
    assert register(client).status_code == 503
