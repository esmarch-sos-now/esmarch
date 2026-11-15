"""Support requests: signed-in responders (courses, application, admin approval), state in Postgres, photos in
object storage and Supabase Realtime "changed" signals. Every action is plain HTTP."""

import uuid

import pytest

from app.core import clock, supabase
from app.core.config import get_settings
from tests.auth_tokens import bearer
from tests.helpers import become_responder

HERE = (10.8, 106.7)
NEAR = (10.81, 106.7)  # ~1.1 km
FAR = (10.84, 106.7)  # ~4.4 km: outside the default 3 km radius
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64


@pytest.fixture(autouse=True)
def clean_storage():
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
    return become_responder(client, user(email, name), user_id(email))


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


def test_a_signed_in_user_is_not_a_responder_until_approved(client):
    auth = user("an@example.com", "An")
    assert client.get("/api/support/me", headers=auth).json()["status"] == "none"
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
    assert client.get(photo, headers=auth).status_code == 200  # invited: sees the scene to decide

    detail = client.post(f"/api/support/me/requests/{created['id']}/accept", headers=auth).json()
    assert detail["contactPhone"] == "0912345678" and detail["latitude"] == HERE[0] and detail["photoCount"] == 1
    assert (f"support:request:{created['id']}", {"type": "request.accepted"}) in signals
    state = client.get(f"/api/support-requests/{created['id']}", headers=owner(created)).json()
    assert state["status"] == "ACCEPTED" and state["responder"]["displayName"] == "Hải"

    got = client.get(photo, headers=auth)
    assert got.status_code == 200 and got.content == PNG
    other = responder(client, "khac@example.com", "Khác")
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


# ---- area dispatch, readiness without GPS, scene media -------------------------------------------
AREA = "Quận 1"
MP4 = b"\x00\x00\x00\x18ftypmp42" + b"0" * 64


def ready(client, auth):
    """Ready to help the way the supporter page does it: no GPS."""
    r = client.put("/api/support/me/availability", headers=auth, json={"available": True})
    assert r.status_code == 200 and r.json()["available"] is True, r.text


def ask_in_area(client, where=HERE, area=AREA):
    return client.post(
        "/api/support-requests",
        json={
            "latitude": where[0],
            "longitude": where[1],
            "area": area,
            "shareLocationWithAcceptedResponder": True,
            "contactPhone": "0912-345-678",
            "situation": "Bất tỉnh",
        },
    )


def test_area_request_invites_every_ready_responder_without_gps(client, signals):
    a, b = responder(client, "a@example.com", "A"), responder(client, "b@example.com", "B")
    responder(client, "idle@example.com", "Idle")  # enrolled but not ready
    assert ask_in_area(client).status_code == 409  # nobody is ready yet
    ready(client, a)
    go_available(client, b, FAR)  # a position outside any radius does not matter for area requests
    assert ask_in_area(client, area="Mars").status_code == 400
    created = ask_in_area(client).json()
    assert created["invitedCount"] == 2
    [offer] = client.get("/api/support/me/requests", headers=a).json()
    assert offer["area"] == AREA and "approximateDistanceMeters" not in offer and "latitude" not in offer
    assert (f"support:responder:{user_id('idle@example.com')}", {"type": "request.new"}) not in signals

    # A responder who gets ready later also gets the waiting area request.
    late = responder(client, "c@example.com", "C")
    ready(client, late)
    assert [r["id"] for r in client.get("/api/support/me/requests", headers=late).json()] == [created["id"]]


def test_scene_media_is_shown_to_invited_responders_until_someone_accepts(client, signals):
    auth = responder(client)
    ready(client, auth)
    created = ask_in_area(client).json()
    other = responder(client, "khac@example.com", "Khác")  # enrolled after the request: not invited
    requester = owner(created)

    png = {"file": ("a.png", PNG, "image/png")}
    assert client.post(f"/api/support-requests/{created['id']}/photos", headers=requester, files=png).status_code == 201
    video_url = f"/api/support-requests/{created['id']}/video"
    gif = {"file": ("v.gif", b"GIF89a", "image/gif")}
    assert client.post(video_url, headers=requester, files=gif).status_code == 400
    mp4 = {"file": ("v.mp4", MP4, "video/mp4")}
    assert client.post(video_url, headers=requester, files=mp4).status_code == 201
    assert (f"support:responder:{user_id('hai@example.com')}", {"type": "request.detail"}) in signals
    [offer] = client.get("/api/support/me/requests", headers=auth).json()
    assert offer["photoCount"] == 1 and offer["hasVideo"] is True

    base = f"/api/support/me/requests/{created['id']}"
    assert client.get(f"{base}/video-url", headers=auth).json() == {"url": None}  # no Storage: stream it
    got = client.get(f"{base}/video", headers=auth)
    assert got.status_code == 200 and got.content == MP4 and got.headers["content-type"] == "video/mp4"
    for path in ("/photos/0", "/video", "/video-url"):
        assert client.get(base + path, headers=other).status_code == 403

    assert client.post(f"{base}/accept", headers=auth).json()["hasVideo"] is True
    assert client.get(f"{base}/video", headers=auth).status_code == 200
    moved = {"latitude": 10.805, "longitude": 106.7}
    assert client.post("/api/support/me/location", headers=auth, json=moved).status_code == 204
    assert client.post(f"{base}/complete", headers=auth).status_code == 204
    assert client.get(f"{base}/video", headers=auth).status_code == 403  # gone with the request
    assert supabase._memory.objects == {}

    # The position shared while helping is wiped when the request ends; readiness stays on.
    assert client.get("/api/support/me", headers=auth).json()["available"] is True
    again = ask_in_area(client).json()
    client.post(f"/api/support/me/requests/{again['id']}/accept", headers=auth)
    state = client.get(f"/api/support-requests/{again['id']}", headers=owner(again)).json()
    assert "latitude" not in state["responder"]


def test_readiness_keepalive_keeps_the_position_shared_while_helping(client):
    auth = responder(client)
    ready(client, auth)
    created = ask_in_area(client).json()
    client.post(f"/api/support/me/requests/{created['id']}/accept", headers=auth)
    client.post("/api/support/me/location", headers=auth, json={"latitude": 10.805, "longitude": 106.7})
    ready(client, auth)  # the page's keep-alive
    state = client.get(f"/api/support-requests/{created['id']}", headers=owner(created)).json()
    assert state["responder"]["latitude"] == 10.805


class FakeStorage(supabase.SupabaseStorage):
    """Supabase Storage with its HTTP calls replaced: the signed-upload path without a Supabase project."""

    def __init__(self) -> None:
        super().__init__("https://test-project.supabase.co", "service-key", "support-photos")
        self.objects: dict[str, tuple[int, str]] = {}
        self.deleted: list[str] = []

    def signed_upload(self, path: str) -> str:
        return f"upload-token-for-{path}"

    def info(self, path: str):
        return self.objects.get(path)

    def signed_url(self, path: str, expires_in: int) -> str:
        return f"{self.base}/object/sign/{self.bucket}/{path}?token=t&expires={expires_in}"

    def delete(self, paths: list[str]) -> None:
        self.deleted.extend(paths)
        for p in paths:
            self.objects.pop(p, None)


def test_signed_video_upload_is_checked_before_responders_see_it(client, monkeypatch):
    from app.modules.support import service as support_service

    storage = FakeStorage()
    monkeypatch.setattr(support_service, "get_storage", lambda: storage)
    auth = responder(client)
    ready(client, auth)
    created = ask_in_area(client).json()
    rid, requester = created["id"], owner(created)

    assert client.post(f"/api/support-requests/{rid}/video-upload").status_code == 401
    plan = client.post(f"/api/support-requests/{rid}/video-upload", headers=requester).json()
    assert plan == {
        "mode": "signed",
        "bucket": "support-photos",
        "path": f"{rid}/video",
        "token": f"upload-token-for-{rid}/video",
        "maxBytes": get_settings().support_video_max_bytes,
    }
    complete = f"/api/support-requests/{rid}/video/complete"
    assert client.post(complete, headers=requester).status_code == 404  # nothing uploaded yet

    storage.objects[f"{rid}/video"] = (get_settings().support_video_max_bytes + 1, "video/mp4")
    assert client.post(complete, headers=requester).status_code == 400  # too large: removed
    assert f"{rid}/video" in storage.deleted and f"{rid}/video" not in storage.objects
    storage.objects[f"{rid}/video"] = (1000, "image/gif")
    assert client.post(complete, headers=requester).status_code == 400

    storage.objects[f"{rid}/video"] = (1000, "video/webm; codecs=vp9")
    assert client.post(complete, headers=requester).json() == {"hasVideo": True}
    link = client.get(f"/api/support/me/requests/{rid}/video-url", headers=auth).json()["url"]
    assert link.startswith("https://test-project.supabase.co/storage/v1/object/sign/support-photos/")
    assert "expires=300" in link

    assert client.delete(f"/api/support-requests/{rid}", headers=requester).status_code == 204
    assert f"{rid}/video" not in storage.objects  # wiped with the request
