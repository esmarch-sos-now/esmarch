"""The backend accepts only this Supabase project's signed-in user tokens, sent as `Authorization: Bearer`."""

import time

import pytest
from cryptography.hazmat.primitives.asymmetric import ec

from app.core.config import get_settings
from tests.auth_tokens import bearer, token


def me(client, headers):
    return client.get("/api/auth/me", headers=headers)


def test_valid_token_identifies_the_user(client):
    r = me(client, bearer(user_id="7f1c3a52-0d2e-4c7a-9a55-1b8f0c6d2e11", phone="84912345678", name="  An   Nguyễn "))
    assert r.status_code == 200
    assert r.json() == {
        "id": "7f1c3a52-0d2e-4c7a-9a55-1b8f0c6d2e11",
        "phone": "+84912345678",
        "email": None,
        "displayName": "An Nguyễn",
    }


def test_missing_or_malformed_credentials(client):
    assert me(client, {}).status_code == 401
    assert me(client, {"Authorization": "Basic abc"}).status_code == 401
    r = me(client, {"Authorization": "Bearer not-a-jwt"})
    assert r.status_code == 401 and r.headers["www-authenticate"] == "Bearer"


@pytest.mark.parametrize(
    "overrides",
    [
        {"exp": int(time.time()) - 60},  # expired
        {"iss": "https://other-project.supabase.co/auth/v1"},  # another project
        {"aud": "anon"},
        {"role": "anon"},
        {"role": "service_role"},
        {"is_anonymous": True},
    ],
)
def test_rejects_foreign_or_unsuitable_tokens(client, overrides):
    assert me(client, bearer(**overrides)).status_code == 401


def test_rejects_wrong_key_and_symmetric_tokens(client):
    other = ec.generate_private_key(ec.SECP256R1())
    assert me(client, {"Authorization": f"Bearer {token(key=other)}"}).status_code == 401
    hs = token(key="a-shared-secret-that-must-never-be-accepted-here", algorithm="HS256")
    assert me(client, {"Authorization": f"Bearer {hs}"}).status_code == 401


def test_unconfigured_accounts_answer_503(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "supabase_url", "")
    assert me(client, bearer()).status_code == 503
