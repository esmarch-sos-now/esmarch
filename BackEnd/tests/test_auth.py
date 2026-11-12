import pytest

from app.core import clock
from app.modules.auth import mailer

PASSWORD = "correct horse battery"


def other_code(code: str) -> str:
    return f"{(int(code) + 1) % 1_000_000:06d}"


@pytest.fixture
def outbox(monkeypatch):
    """Captures mailed codes instead of calling Resend."""
    sent: list[dict] = []
    monkeypatch.setattr(
        mailer, "send_code", lambda to, purpose, code, minutes: sent.append(dict(to=to, purpose=purpose, code=code))
    )
    monkeypatch.setattr(mailer, "send_already_registered", lambda to: sent.append(dict(to=to, purpose="EXISTS")))
    return sent


def register(client, email="An@Example.com", password=PASSWORD):
    return client.post("/api/auth/register", json={"email": email, "password": password, "displayName": " An  Nguyễn "})


def login(client, email="an@example.com", password=PASSWORD):
    return client.post("/api/auth/token", data={"username": email, "password": password})


def signed_up(client, outbox) -> dict:
    assert register(client).status_code == 202
    r = client.post("/api/auth/verify-email", json={"email": "an@example.com", "code": outbox[-1]["code"]})
    assert r.status_code == 200
    return r.json()


def bearer(tokens: dict) -> dict:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def test_register_verify_and_me(client, outbox):
    assert register(client).json() == {"status": "accepted"}
    assert outbox[-1]["to"] == "an@example.com" and outbox[-1]["purpose"] == "VERIFY_EMAIL"
    assert login(client).status_code == 403  # not verified yet

    good_code = outbox[-1]["code"]
    bad = client.post("/api/auth/verify-email", json={"email": "an@example.com", "code": other_code(good_code)})
    assert bad.status_code == 400

    tokens = client.post("/api/auth/verify-email", json={"email": "an@example.com", "code": good_code}).json()
    assert tokens["token_type"] == "bearer" and tokens["expires_in"] == 900
    me = client.get("/api/auth/me", headers=bearer(tokens)).json()
    assert me["email"] == "an@example.com" and me["displayName"] == "An Nguyễn" and me["emailVerified"] is True

    # the code is single use
    again = client.post("/api/auth/verify-email", json={"email": "an@example.com", "code": good_code})
    assert again.status_code == 400


def test_existing_email_is_not_revealed(client, outbox):
    signed_up(client, outbox)
    r = register(client)
    assert r.status_code == 202 and outbox[-1]["purpose"] == "EXISTS"


def test_resend_cooldown(client, outbox):
    register(client)
    client.post("/api/auth/resend-verification", json={"email": "an@example.com"})
    assert len(outbox) == 1
    clock.advance(61)
    client.post("/api/auth/resend-verification", json={"email": "an@example.com"})
    assert len(outbox) == 2
    if outbox[0]["code"] != outbox[1]["code"]:  # the earlier code is replaced
        old = client.post("/api/auth/verify-email", json={"email": "an@example.com", "code": outbox[0]["code"]})
        assert old.status_code == 400


def test_code_attempt_limit(client, outbox):
    register(client)
    code = outbox[-1]["code"]
    wrong = other_code(code)
    for _ in range(5):
        client.post("/api/auth/verify-email", json={"email": "an@example.com", "code": wrong})
    r = client.post("/api/auth/verify-email", json={"email": "an@example.com", "code": code})
    assert r.status_code == 400


def test_code_expires(client, outbox):
    register(client)
    clock.advance(601)
    r = client.post("/api/auth/verify-email", json={"email": "an@example.com", "code": outbox[-1]["code"]})
    assert r.status_code == 400


def test_login_errors_are_uniform(client, outbox):
    signed_up(client, outbox)
    assert login(client).status_code == 200
    unknown, wrong = login(client, email="nobody@example.com"), login(client, password="wrong password")
    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json()["detail"] == wrong.json()["detail"]
    assert unknown.headers.get("www-authenticate") is None  # form login is not a bearer challenge


def test_login_rate_limit(client, outbox):
    signed_up(client, outbox)
    codes = [login(client, password="wrong password").status_code for _ in range(11)]
    assert codes[-1] == 429


def test_access_token_expiry_and_garbage(client, outbox):
    tokens = signed_up(client, outbox)
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer nope"}).status_code == 401
    clock.advance(901)
    r = client.get("/api/auth/me", headers=bearer(tokens))
    assert r.status_code == 401 and r.headers["www-authenticate"] == "Bearer"


def test_refresh_rotation_and_reuse_detection(client, outbox):
    first = signed_up(client, outbox)
    second = client.post("/api/auth/refresh", json={"refreshToken": first["refresh_token"]}).json()
    assert second["refresh_token"] != first["refresh_token"]

    # parallel requests reusing the just-rotated token within the grace window still succeed
    sibling = client.post("/api/auth/refresh", json={"refreshToken": first["refresh_token"]})
    assert sibling.status_code == 200

    clock.advance(30)  # past the grace window, an old token means theft: the whole session ends
    assert client.post("/api/auth/refresh", json={"refreshToken": first["refresh_token"]}).status_code == 401
    assert client.post("/api/auth/refresh", json={"refreshToken": second["refresh_token"]}).status_code == 401


def test_refresh_expiry(client, outbox):
    tokens = signed_up(client, outbox)
    clock.advance(31 * 86400)
    assert client.post("/api/auth/refresh", json={"refreshToken": tokens["refresh_token"]}).status_code == 401


def test_logout_revokes_session(client, outbox):
    tokens = signed_up(client, outbox)
    other = login(client).json()
    assert client.post("/api/auth/logout", json={"refreshToken": tokens["refresh_token"]}).status_code == 204
    assert client.post("/api/auth/refresh", json={"refreshToken": tokens["refresh_token"]}).status_code == 401
    assert client.post("/api/auth/refresh", json={"refreshToken": other["refresh_token"]}).status_code == 200


def test_logout_all(client, outbox):
    tokens = signed_up(client, outbox)
    other = login(client).json()
    assert client.post("/api/auth/logout-all", headers=bearer(tokens)).status_code == 204
    assert client.post("/api/auth/refresh", json={"refreshToken": other["refresh_token"]}).status_code == 401


def test_password_reset(client, outbox):
    tokens = signed_up(client, outbox)
    assert client.post("/api/auth/password/forgot", json={"email": "nobody@example.com"}).status_code == 202
    assert client.post("/api/auth/password/forgot", json={"email": "AN@example.com"}).status_code == 202
    assert outbox[-1]["purpose"] == "RESET_PASSWORD"
    body = {"email": "an@example.com", "code": outbox[-1]["code"], "newPassword": "a brand new password"}
    assert client.post("/api/auth/password/reset", json=body).status_code == 204
    assert client.post("/api/auth/refresh", json={"refreshToken": tokens["refresh_token"]}).status_code == 401
    assert login(client).status_code == 401
    assert login(client, password="a brand new password").status_code == 200


def test_change_password_and_profile(client, outbox):
    tokens = signed_up(client, outbox)
    wrong = {"currentPassword": "nope", "newPassword": "another long password"}
    assert client.post("/api/auth/password/change", json=wrong, headers=bearer(tokens)).status_code == 400
    ok = {"currentPassword": PASSWORD, "newPassword": "another long password"}
    fresh = client.post("/api/auth/password/change", json=ok, headers=bearer(tokens))
    assert fresh.status_code == 200
    assert client.post("/api/auth/refresh", json={"refreshToken": tokens["refresh_token"]}).status_code == 401
    me = client.patch("/api/auth/me", json={"displayName": "Bình"}, headers=bearer(fresh.json()))
    assert me.json()["displayName"] == "Bình"


def test_short_password_rejected(client, outbox):
    assert register(client, password="short").status_code == 400
    assert outbox == []
