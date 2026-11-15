"""Support requests: signed-in responders (demo self-enrolment), state in Postgres, photos in object storage and
Supabase Realtime "changed" signals. Every action is plain HTTP."""

import uuid

import pytest

from app.core import clock, supabase
from app.core.config import get_settings
from tests.auth_tokens import bearer

HERE = (10.8, 106.7)
NEAR = (10.81, 106.7)  # ~1.1 km
FAR = (10.84, 106.7)  # ~4.4 km: outside the default 3 km radius
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64


@pytest.fixture(autouse=True)
def demo_enrolment(monkeypatch):
    monkeypatch.setattr(get_settings(), "support_demo_self_enroll", True)
    supabase._memory.objects.clear()


@pytest.fixture
def signals(monkeypatch):
    """Realtime signals the backend sends (topic, payload) once each request is done."""
    sent: list[tuple[str, dict]] = []
    monkeypatch.setattr(supabase, "broadcast", lambda topics: sent.extend(topics))
    return sent


def user_id(email: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, email))


def user(email: str, name: str) -> dict:
    """A signed-in Supabase user (accounts live in Supabase, so nothing is stored here)."""
    return bearer(user_id=user_id(email), email=email, name=name)


def responder(client, email="hai@example.com", name="Hải"):
    auth = user(email, name)
    r = client.post("/api/support/me", headers=auth, json={"contactPhone": "0903 000 111"})
    assert r.status_code == 200 and r.json()["enrolled"] is True, r.text
    return auth


def go_available(client, auth, where=HERE):
    body = {"available": True, "latitude": where[0], "longitude": where[1], "consentToLocationUse": True}
    assert client.put("/api/support/me/availability", headers=auth, json=body).json()["available"] is True


def ask_for_help(client, where=HERE, radius=0):
    return client.post(
        "/api/support-requests",
        json={
            "latitude": where[0],
            "longitude": where[1],
            "radius": radius,
            "shareLocationWithAcceptedResponder": True,
            "contactPhone": "0912-345-678",
            "situation": "Bất tỉnh",
            "description": "Người lớn tuổi ngã ở cổng chợ",
        },
    )


def owner(created: dict) -> dict:
    return {"Authorization": f"Bearer {created['requesterToken']}"}


def invited_count(client, created: dict) -> int:
    return client.get(f"/api/support-requests/{created['id']}", headers=owner(created)).json()["invitedCount"]


def test_self_enrolment_needs_the_flag_and_a_phone(client, monkeypatch):
    auth = user("an@example.com", "An")
    assert client.get("/api/support/me", headers=auth).json()["enrolled"] is False
    assert client.post("/api/support/me", headers=auth, json={"contactPhone": "abc"}).status_code == 400
    monkeypatch.setattr(get_settings(), "support_demo_self_enroll", False)
    assert client.post("/api/support/me", headers=auth, json={"contactPhone": "0903000111"}).status_code == 403
    assert client.get("/api/support/me/requests", headers=auth).status_code == 404  # not a responder
    assert client.get("/api/support/me/requests").status_code == 401


def test_live_flow_keeps_details_private_until_accepted(client, signals):
    auth = responder(client)
    go_available(client, auth, NEAR)

    created = ask_for_help(client).json()
    [offer] = client.get("/api/support/me/requests", headers=auth).json()
    assert offer["situation"] == "Bất tỉnh" and offer["approximateDistanceMeters"] == 1100
    assert "latitude" not in offer and "contactPhone" not in offer
    assert (f"support:responder:{user_id('hai@example.com')}", {"type": "request.new"}) in signals

    url = f"/api/support-requests/{created['id']}/photos"
    png = {"file": ("a.png", PNG, "image/png")}
    assert client.post(url, headers=owner(created), files=png).status_code == 201
    gif = {"file": ("a.gif", b"GIF89a", "image/gif")}
    assert client.post(url, headers=owner(created), files=gif).status_code == 400
    photo = f"/api/support/me/requests/{created['id']}/photos/0"
    assert client.get(photo, headers=auth).status_code == 403  # not accepted yet

    detail = client.post(f"/api/support/me/requests/{created['id']}/accept", headers=auth).json()
    assert detail["contactPhone"] == "0912345678" and detail["latitude"] == HERE[0] and detail["photoCount"] == 1
    assert (f"support:request:{created['id']}", {"type": "request.accepted"}) in signals
    state = client.get(f"/api/support-requests/{created['id']}", headers=owner(created)).json()
    assert state["status"] == "ACCEPTED" and state["responder"]["displayName"] == "Hải"

    got = client.get(photo, headers=auth)
    assert got.status_code == 200 and got.content == PNG
    other = user("khac@example.com", "Khác")
    client.post("/api/support/me", headers=other, json={"contactPhone": "0903000222"})
    assert client.get(photo, headers=other).status_code == 403

    moved = {"latitude": 10.805, "longitude": 106.7}
    assert client.post("/api/support/me/location", headers=auth, json=moved).status_code == 204
    assert (f"support:request:{created['id']}", {"type": "responder.location"}) in signals
    state = client.get(f"/api/support-requests/{created['id']}", headers=owner(created)).json()
    assert state["responder"]["latitude"] == 10.805 and 500 < state["responder"]["distanceMeters"] < 600

    assert client.post(f"/api/support/me/requests/{created['id']}/complete", headers=auth).status_code == 204
    assert (f"support:request:{created['id']}", {"type": "request.completed"}) in signals
    assert client.get(photo, headers=auth).status_code == 403  # dropped with the request
    assert supabase._memory.objects == {}  # and removed from storage


def test_signals_carry_no_personal_data(client, signals):
    go_available(client, responder(client), NEAR)
    ask_for_help(client)
    assert signals
    for topic, payload in signals:
        assert topic.startswith("support:") and set(payload) <= {"type", "requestId"}
        assert "0912" not in str(payload) and "10.8" not in str(payload)


def test_first_accept_wins_and_others_are_told(client, signals):
    a, b = responder(client, "a@example.com", "A"), responder(client, "b@example.com", "B")
    go_available(client, a)
    go_available(client, b, NEAR)
    created = ask_for_help(client).json()
    assert created["invitedCount"] == 2 and created["delivery"] in ("RESPONDER_PUSH", "RESPONDER_POLLING")
    assert client.post(f"/api/support/me/requests/{created['id']}/accept", headers=a).status_code == 200
    assert (f"support:responder:{user_id('b@example.com')}", {"type": "request.taken"}) in signals
    late = client.post(f"/api/support/me/requests/{created['id']}/accept", headers=b)
    assert late.status_code == 409 and late.json()["detail"] == "Support request is no longer open."


def test_late_responder_gets_the_open_request_and_decline_updates_the_count(client, signals):
    a = responder(client, "a@example.com", "A")
    go_available(client, a)
    created = ask_for_help(client).json()
    assert invited_count(client, created) == 1

    b = responder(client, "b@example.com", "B")
    go_available(client, b, NEAR)
    assert [r["id"] for r in client.get("/api/support/me/requests", headers=b).json()] == [created["id"]]
    assert invited_count(client, created) == 2

    assert client.post(f"/api/support/me/requests/{created['id']}/decline", headers=b).status_code == 204
    assert invited_count(client, created) == 1 and client.get("/api/support/me/requests", headers=b).json() == []
    assert client.delete(f"/api/support-requests/{created['id']}", headers=owner(created)).status_code == 204
    assert (f"support:responder:{user_id('a@example.com')}", {"type": "request.cancelled"}) in signals


def test_default_radius_is_three_kilometres(client):
    auth = responder(client)
    go_available(client, auth, FAR)
    assert ask_for_help(client).status_code == 409
    go_available(client, auth, NEAR)
    assert ask_for_help(client).status_code == 201


def test_http_flow_for_signed_in_responders(client):
    auth = responder(client)
    go_available(client, auth, NEAR)
    created = ask_for_help(client).json()
    inbox = client.get("/api/support/me/requests", headers=auth).json()
    assert [r["id"] for r in inbox] == [created["id"]] and "contactPhone" not in inbox[0]
    accepted = client.post(f"/api/support/me/requests/{created['id']}/accept", headers=auth).json()
    assert accepted["contactPhone"] == "0912345678"
    state = client.get(f"/api/support-requests/{created['id']}", headers=owner(created)).json()
    assert state["responder"]["displayName"] == "Hải" and state["responder"]["distanceMeters"] > 1000
    assert client.post(f"/api/support/me/requests/{created['id']}/complete", headers=auth).status_code == 204


def test_expiry_wipes_presence_requests_and_photos(client):
    auth = responder(client)
    go_available(client, auth, NEAR)
    created = ask_for_help(client).json()
    files = {"file": ("a.png", PNG, "image/png")}
    client.post(f"/api/support-requests/{created['id']}/photos", headers=owner(created), files=files)
    assert len(supabase._memory.objects) == 1
    clock.advance(11 * 60)
    assert client.get(f"/api/support-requests/{created['id']}", headers=owner(created)).status_code == 404
    assert supabase._memory.objects == {}
    assert client.get("/api/support/me", headers=auth).json()["available"] is False  # presence expired too


def test_state_is_in_the_database_not_in_the_process(client, session):
    from sqlalchemy import text

    go_available(client, responder(client), NEAR)
    created = ask_for_help(client).json()
    rows = session.execute(text("SELECT count(*) FROM support_requests WHERE id = :i"), {"i": created["id"]}).scalar()
    presence = session.execute(text("SELECT count(*) FROM support_presence")).scalar()
    assert rows == 1 and presence == 1
