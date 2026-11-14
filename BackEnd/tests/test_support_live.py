"""'Tìm kiếm người hỗ trợ': signed-in responders (demo self-enrolment) and the /api/support/ws live channel."""

from contextlib import ExitStack
from datetime import UTC, datetime

import pytest
from starlette.websockets import WebSocketDisconnect

from app.core.config import get_settings
from app.modules.auth.models import User
from app.modules.auth.security import create_access_token

ORIGIN = {"origin": "http://localhost:3000"}
HERE = (10.8, 106.7)
NEAR = (10.81, 106.7)  # ~1.1 km
AREA = "Quận 1"  # the incident area every request carries; responders are invited by readiness, not by distance
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64


_sockets = ExitStack()


@pytest.fixture(autouse=True)
def demo_enrolment(monkeypatch):
    monkeypatch.setattr(get_settings(), "support_demo_self_enroll", True)
    monkeypatch.setattr(get_settings(), "support_offline_grace_seconds", 0)
    yield
    _sockets.close()  # every socket opened by connect()/requester_socket() is closed cleanly after the test
    _early.clear()


def user(session, email: str, name: str) -> dict:
    u = User(
        email=email,
        password_hash="x",
        display_name=name,
        email_verified_at=datetime(2026, 1, 1, tzinfo=UTC),
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
    )
    session.add(u)
    session.commit()
    return {"Authorization": f"Bearer {create_access_token(u.id)[0]}"}


def responder(client, session, email="hai@example.com", name="Hải"):
    auth = user(session, email, name)
    r = client.post("/api/support/me", headers=auth, json={"contactPhone": "0903 000 111"})
    assert r.status_code == 200 and r.json()["enrolled"] is True, r.text
    return auth


def connect(client, auth):
    ticket = client.post("/api/support/ws-ticket", headers=auth).json()["ticket"]
    ws = _sockets.enter_context(client.websocket_connect("/api/support/ws", headers=ORIGIN))
    ws.send_json({"type": "hello", "role": "responder", "ticket": ticket})
    assert ws.receive_json()["type"] == "ready"
    return ws


def go_available(client, auth):
    """Ready to help, the way the supporter page does it: over HTTP, with no GPS (shared only after accepting)."""
    response = client.put("/api/support/me/availability", headers=auth, json={"available": True})
    assert response.status_code == 200 and response.json()["available"] is True, response.text


_early: dict[int, list[dict]] = {}


def expect(ws, kind: str, limit: int = 10) -> dict:
    """Next message of `kind`; messages of other kinds are kept for later calls (pushes may arrive before replies)."""
    held = _early.setdefault(id(ws), [])
    for i, message in enumerate(held):
        if message["type"] == kind:
            return held.pop(i)
    for _ in range(limit):
        message = ws.receive_json()
        if message["type"] == kind:
            return message
        held.append(message)
    raise AssertionError(f"no {kind} message")


def ask_for_help(client, where=HERE):
    return client.post(
        "/api/support-requests",
        json={
            "latitude": where[0],
            "longitude": where[1],
            "area": AREA,
            "shareLocationWithAcceptedResponder": True,
            "contactPhone": "0912-345-678",
            "situation": "Bất tỉnh",
            "description": "Người lớn tuổi ngã ở cổng chợ",
        },
    )


def requester_socket(client, created: dict):
    ws = _sockets.enter_context(client.websocket_connect("/api/support/ws", headers=ORIGIN))
    ws.send_json({"type": "hello", "role": "requester", "requestId": created["id"], "token": created["requesterToken"]})
    assert expect(ws, "request.state")["request"]["status"] == "OPEN"
    return ws


def test_self_enrolment_needs_the_flag_and_a_phone(client, session, monkeypatch):
    auth = user(session, "an@example.com", "An")
    assert client.get("/api/support/me", headers=auth).json()["enrolled"] is False
    assert client.post("/api/support/me", headers=auth, json={"contactPhone": "abc"}).status_code == 400
    monkeypatch.setattr(get_settings(), "support_demo_self_enroll", False)
    assert client.post("/api/support/me", headers=auth, json={"contactPhone": "0903000111"}).status_code == 403
    assert client.post("/api/support/ws-ticket", headers=auth).status_code == 404  # not a responder
    assert client.post("/api/support/ws-ticket").status_code == 401


def test_socket_needs_origin_and_a_one_time_ticket(client, session):
    auth = responder(client, session)
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/api/support/ws", headers={"origin": "https://evil.example"}) as ws:
            ws.receive_json()
    ticket = client.post("/api/support/ws-ticket", headers=auth).json()["ticket"]
    with client.websocket_connect("/api/support/ws", headers=ORIGIN) as ws:
        ws.send_json({"type": "hello", "role": "responder", "ticket": ticket})
        assert ws.receive_json()["type"] == "ready"
    with pytest.raises(WebSocketDisconnect):  # reused ticket
        with client.websocket_connect("/api/support/ws", headers=ORIGIN) as ws:
            ws.send_json({"type": "hello", "role": "responder", "ticket": ticket})
            ws.receive_json()


def test_live_flow_keeps_details_private_until_accepted(client, session):
    auth = responder(client, session)
    hai = connect(client, auth)
    go_available(client, auth)

    response = ask_for_help(client)
    assert response.status_code == 201, response.text
    created = response.json()
    offer = expect(hai, "request.new")["request"]
    assert offer["situation"] == "Bất tỉnh" and offer["area"] == AREA
    assert "latitude" not in offer and "contactPhone" not in offer

    asker = requester_socket(client, created)
    owner = {"Authorization": f"Bearer {created['requesterToken']}"}
    files = {"file": ("a.png", PNG, "image/png")}
    assert client.post(f"/api/support-requests/{created['id']}/photos", headers=owner, files=files).status_code == 201
    bad = {"file": ("a.gif", b"GIF89a", "image/gif")}
    assert client.post(f"/api/support-requests/{created['id']}/photos", headers=owner, files=bad).status_code == 400
    assert expect(hai, "request.new")["request"]["photoCount"] == 1  # the ringing offer is updated when media arrives

    mp4 = b"\x00\x00\x00\x18ftypmp42" + b"0" * 64
    video_file = {"file": ("v.mp4", mp4, "video/mp4")}
    video_url = f"/api/support-requests/{created['id']}/video"
    assert client.post(video_url, headers=owner, files=video_file).status_code == 201
    bad_video = {"file": ("v.gif", b"GIF89a", "image/gif")}
    assert client.post(video_url, headers=owner, files=bad_video).status_code == 400
    assert expect(hai, "request.new")["request"]["hasVideo"] is True

    # While the request is open the invited responder sees the scene media; a responder who was not invited does not.
    photo = f"/api/support/me/requests/{created['id']}/photos/0"
    video = f"/api/support/me/requests/{created['id']}/video"
    other = user(session, "khac@example.com", "Khác")
    client.post("/api/support/me", headers=other, json={"contactPhone": "0903000222"})
    got = client.get(photo, headers=auth)
    assert got.status_code == 200 and got.content == PNG
    got = client.get(video, headers=auth)
    assert got.status_code == 200 and got.content == mp4 and got.headers["content-type"] == "video/mp4"
    assert client.get(photo, headers=other).status_code == 403
    assert client.get(video, headers=other).status_code == 403

    hai.send_json({"type": "accept", "requestId": created["id"]})
    detail = expect(hai, "request.detail")["request"]
    assert detail["contactPhone"] == "0912345678" and detail["latitude"] == HERE[0] and detail["photoCount"] == 1
    assert detail["hasVideo"] is True
    accepted = expect(asker, "request.accepted")["request"]
    assert accepted["status"] == "ACCEPTED" and accepted["responder"]["displayName"] == "Hải"

    got = client.get(photo, headers=auth)
    assert got.status_code == 200 and got.content == PNG
    assert client.get(video, headers=auth).status_code == 200
    assert client.get(photo, headers=other).status_code == 403
    assert client.get(video, headers=other).status_code == 403

    hai.send_json({"type": "location", "latitude": 10.805, "longitude": 106.7})
    moved = expect(asker, "responder.location")
    assert moved["latitude"] == 10.805 and 500 < moved["distanceMeters"] < 600

    hai.send_json({"type": "complete", "requestId": created["id"]})
    assert expect(asker, "request.completed")["requestId"] == created["id"]
    assert client.get(photo, headers=auth).status_code == 403  # dropped with the request
    assert client.get(video, headers=auth).status_code == 403


def test_first_accept_wins_and_others_are_told(client, session):
    auth_a = responder(client, session, "a@example.com", "A")
    auth_b = responder(client, session, "b@example.com", "B")
    a, b = connect(client, auth_a), connect(client, auth_b)
    go_available(client, auth_a)
    go_available(client, auth_b)
    created = ask_for_help(client).json()
    assert created["invitedCount"] == 2 and created["delivery"] == "RESPONDER_PUSH"
    expect(a, "request.new")
    expect(b, "request.new")
    a.send_json({"type": "accept", "requestId": created["id"]})
    expect(a, "request.detail")
    assert expect(b, "request.taken")["requestId"] == created["id"]
    b.send_json({"type": "accept", "requestId": created["id"]})
    assert expect(b, "error")["message"] == "Support request is no longer open."


def test_late_responder_gets_the_open_request_and_decline_updates_the_count(client, session):
    auth_a = responder(client, session, "a@example.com", "A")
    a = connect(client, auth_a)
    go_available(client, auth_a)
    created = ask_for_help(client).json()
    asker = requester_socket(client, created)

    auth_b = responder(client, session, "b@example.com", "B")
    b = connect(client, auth_b)
    go_available(client, auth_b)
    assert expect(b, "request.new")["request"]["id"] == created["id"]
    assert expect(asker, "request.invited")["invitedCount"] == 2

    b.send_json({"type": "decline", "requestId": created["id"]})
    assert expect(asker, "request.invited")["invitedCount"] == 1
    asker.send_json({"type": "cancel"})
    assert expect(a, "request.cancelled")["requestId"] == created["id"]


def test_area_request_invites_every_ready_responder_and_nobody_idle(client, session):
    auth_ready = responder(client, session, "a@example.com", "A")
    ready = connect(client, auth_ready)
    idle = connect(client, responder(client, session, "b@example.com", "B"))  # connected but not ready to help
    assert ask_for_help(client).status_code == 409  # nobody is ready yet
    go_available(client, auth_ready)
    response = ask_for_help(client)
    assert response.status_code == 201 and response.json()["invitedCount"] == 1
    assert expect(ready, "request.new")["request"]["id"] == response.json()["id"]
    idle.send_json({"type": "ping"})
    assert "request.new" not in [m["type"] for m in _early.get(id(idle), [])]


def test_http_fallback_for_signed_in_responders(client, session):
    auth = responder(client, session)
    ready = client.put("/api/support/me/availability", headers=auth, json={"available": True})
    assert ready.json()["available"] is True
    created = ask_for_help(client).json()
    inbox = client.get("/api/support/me/requests", headers=auth).json()
    assert [r["id"] for r in inbox] == [created["id"]] and "contactPhone" not in inbox[0]
    accepted = client.post(f"/api/support/me/requests/{created['id']}/accept", headers=auth).json()
    assert accepted["contactPhone"] == "0912345678"
    here = {"latitude": NEAR[0], "longitude": NEAR[1]}
    assert client.post("/api/support/me/location", headers=auth, json=here).status_code == 204  # shared after accepting
    owner = {"Authorization": f"Bearer {created['requesterToken']}"}
    state = client.get(f"/api/support-requests/{created['id']}", headers=owner).json()
    assert state["responder"]["displayName"] == "Hải" and state["responder"]["distanceMeters"] > 1000
    assert client.post(f"/api/support/me/requests/{created['id']}/complete", headers=auth).status_code == 204
