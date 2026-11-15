"""Supporter applications: the result email (approved / turned down) and the one-time "you are a supporter" message."""

import uuid

import httpx
import pytest

from app.core import clock, mailer
from app.core.config import get_settings
from app.modules.auth.models import Account, Role
from tests.auth_tokens import bearer
from tests.helpers import finish_courses


def user_id(email: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, email))


def user(email: str = "hai@example.com") -> dict:
    return bearer(user_id=user_id(email), email="", name="Hải")


@pytest.fixture
def admin(session) -> dict:
    account = Account(
        id=str(uuid.uuid4()), phone="+84900000001", display_name="Quản trị", role=Role.ADMIN, created_at=clock.now()
    )
    session.add(account)
    session.commit()
    return bearer(user_id=account.id, phone="84900000001", name="Quản trị")


@pytest.fixture
def outbox(monkeypatch) -> list[dict]:
    """Emails Resend accepted (the HTTP call is faked; a key is set so the mailer tries to send)."""
    sent: list[dict] = []

    def post(url, headers, json, timeout):
        sent.append({"url": url, "auth": headers["Authorization"], **json})
        return httpx.Response(200, json={"id": "email-id"}, request=httpx.Request("POST", url))

    monkeypatch.setattr(get_settings(), "resend_api_key", "re_test_key")
    monkeypatch.setattr(mailer.httpx, "post", post)
    return sent


def applied(client, email: str = "hai@example.com", notify: str = "Hai@Example.com") -> dict:
    auth = user(email)
    client.get("/api/support/me", headers=auth)
    finish_courses(user_id(email))
    r = client.post("/api/support/me/application", headers=auth, json={"commitment": True, "email": notify})
    assert r.status_code == 200, r.text
    return auth


def test_the_application_needs_a_valid_result_email(client):
    auth = user()
    me = client.get("/api/support/me", headers=auth).json()
    assert me["accountEmail"] is None  # phone sign-up: the form asks for one
    finish_courses(user_id("hai@example.com"))
    url = "/api/support/me/application"
    assert client.post(url, headers=auth, json={"commitment": True}).status_code == 400
    assert client.post(url, headers=auth, json={"commitment": True, "email": "not-an-email"}).status_code == 400
    r = client.post(url, headers=auth, json={"commitment": True, "email": " Hai@Example.com "})
    assert r.status_code == 200 and r.json()["notifyEmail"] == "hai@example.com"


def test_approval_emails_the_applicant_and_the_site_welcomes_them_once(client, admin, outbox):
    auth = applied(client)
    rid = user_id("hai@example.com")
    assert outbox == []  # applying sends nothing

    row = client.patch(f"/api/admin/responders/{rid}", json={"verified": True}, headers=admin).json()
    assert row["status"] == "verified" and row["notifiedAt"] and row["notifyEmail"] == "hai@example.com"
    [mail] = outbox
    assert mail["to"] == ["hai@example.com"] and mail["auth"] == "Bearer re_test_key"
    assert "người hỗ trợ" in mail["subject"] and "https://www.sos-esmarch.com/app/san-sang-ho-tro" in mail["text"]

    me = client.get("/api/support/me", headers=auth).json()
    assert me["status"] == "verified" and me["justVerified"] is True
    assert client.post("/api/support/me/welcome", headers=auth).status_code == 204
    assert client.get("/api/support/me", headers=auth).json()["justVerified"] is False

    # Suspending and reinstating is not a new approval: no email, no welcome again
    client.patch(f"/api/admin/responders/{rid}", json={"verified": False}, headers=admin)
    client.patch(f"/api/admin/responders/{rid}", json={"verified": True}, headers=admin)
    assert len(outbox) == 1
    assert client.get("/api/support/me", headers=auth).json()["justVerified"] is False


def test_a_failed_email_does_not_undo_the_approval(client, admin, monkeypatch):
    monkeypatch.setattr(get_settings(), "resend_api_key", "re_test_key")

    def down(url, headers, json, timeout):
        raise httpx.ConnectError("resend is down")

    monkeypatch.setattr(mailer.httpx, "post", down)
    auth = applied(client)
    row = client.patch(f"/api/admin/responders/{user_id('hai@example.com')}", json={"verified": True}, headers=admin)
    assert row.status_code == 200 and row.json()["status"] == "verified" and row.json()["notifiedAt"] is None
    assert client.get("/api/support/me", headers=auth).json()["justVerified"] is True


def test_without_a_key_nothing_is_sent(client, admin, monkeypatch):
    called = []
    monkeypatch.setattr(mailer.httpx, "post", lambda *a, **k: called.append(1))
    applied(client)
    row = client.patch(f"/api/admin/responders/{user_id('hai@example.com')}", json={"verified": True}, headers=admin)
    assert row.json()["status"] == "verified" and row.json()["notifiedAt"] is None and called == []


def test_turning_down_an_application_emails_the_applicant(client, admin, outbox):
    auth = applied(client)
    rid = user_id("hai@example.com")
    assert client.delete(f"/api/admin/responders/{rid}", headers=admin).status_code == 204
    [mail] = outbox
    assert mail["to"] == ["hai@example.com"] and "chưa được duyệt" in mail["text"]
    assert client.get("/api/support/me", headers=auth).json()["status"] == "ready"  # may apply again


def test_removing_a_verified_supporter_sends_no_rejection(client, admin, outbox):
    applied(client)
    rid = user_id("hai@example.com")
    client.patch(f"/api/admin/responders/{rid}", json={"verified": True}, headers=admin)
    outbox.clear()
    assert client.delete(f"/api/admin/responders/{rid}", headers=admin).status_code == 204
    assert outbox == []


def test_welcome_needs_sign_in(client):
    assert client.post("/api/support/me/welcome").status_code == 401
