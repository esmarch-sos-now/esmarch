from datetime import timedelta

import pytest
from fastapi import HTTPException

from app.core import clock
from app.modules.aeds import service as aeds
from app.modules.aeds.schemas import AedImport
from app.modules.guides.schemas import Audience, Guide
from app.modules.guides.service import catalog
from app.modules.support.service import support
from tests.conftest import ADMIN


def guide(lang="vi", audience="ADULT"):
    return Guide.model_validate(
        {
            "scenarioId": "cardiac",
            "locale": lang,
            "audience": audience,
            "title": "Synthetic reviewed guide",
            "steps": [
                {
                    "number": 1,
                    "title": "First",
                    "text": "instruction one",
                    "keywords": ["first", "bước đầu"],
                    "media": [
                        {
                            "type": "VIDEO",
                            "url": "https://m.example.test/g.mp4",
                            "mimeType": "video/mp4",
                            "alt": "v",
                            "startSeconds": 5,
                            "endSeconds": 10,
                        }
                    ],
                },
                {
                    "number": 2,
                    "title": "Second",
                    "text": "instruction two",
                    "keywords": ["second"],
                    "media": [
                        {"type": "IMAGE", "url": "https://m.example.test/g.webp", "mimeType": "image/webp", "alt": "i"},
                        {
                            "type": "MODEL_3D",
                            "url": "https://m.example.test/g.glb",
                            "mimeType": "model/gltf-binary",
                            "alt": "m",
                        },
                    ],
                },
            ],
            "reviewedAt": (clock.now() - timedelta(minutes=1)).isoformat(),
            "reviewedBy": "Test",
            "sources": ["fixture"],
        }
    )


@pytest.fixture
def ready():
    catalog.replace_reviewed([guide()])


def test_guides_media_and_no_adult_fallback(client, ready):
    g = client.get("/api/guides/cardiac").json()
    assert g["status"] == "READY" and set(g["availableFormats"]) == {"IMAGE", "VIDEO", "MODEL_3D"}
    assert g["steps"][0]["media"][0]["startSeconds"] == 5
    for a in ("CHILD", "INFANT"):
        c = client.get("/api/guides/cardiac", params={"audience": a}).json()
        assert c["status"] == "PENDING_REVIEW" and c["steps"] == []
    assert len(client.get("/api/guides", params={"featured": "true"}).json()) == 3


def test_locales_and_errors(client):
    catalog.replace_reviewed([guide(), guide("en", "CHILD")])
    en = client.get("/api/guides/cardiac", params={"locale": "en-US", "audience": "CHILD"}).json()
    assert en["locale"] == "en" and en["status"] == "READY"
    assert "CHILD" in client.get("/api/locales").json()[1]["reviewedAudiences"]
    assert client.get("/api/guides/cardiac", params={"locale": "fr"}).status_code == 400
    assert client.get("/api/guides/missing").status_code == 404


def test_catalog_replacement_is_atomic(ready):
    bad = guide("en").model_copy(update={"reviewed_at": clock.now() + timedelta(minutes=1)})
    with pytest.raises(HTTPException):
        catalog.replace_reviewed([guide(), bad])
    assert catalog.get("cardiac", "en", Audience.ADULT).status == "PENDING_REVIEW"
    unsafe = guide("vi", "CHILD")
    unsafe.steps[0].media[0].url = "javascript:alert(1)"
    with pytest.raises(HTTPException):
        catalog.replace_reviewed([unsafe])
    assert catalog.get("cardiac", "vi", Audience.ADULT).status == "READY"


def test_video_answers_and_wear(client, ready):
    q = {"scenarioId": "cardiac", "locale": "vi", "audience": "ADULT", "positionSeconds": 0}
    m = client.post("/api/video/answers", json={**q, "question": "show first"}).json()
    assert m["status"] == "MATCHED" and m["seekToSeconds"] == 5 and m["answerMode"] == "REVIEWED_CONTENT_LOOKUP"
    assert (
        client.post("/api/video/answers", json={**q, "question": "unknown"}).json()["status"] == "NEEDS_CLARIFICATION"
    )
    body = client.get("/api/wear/guides/cardiac").text
    assert "m.example.test" not in body and "MODEL_3D" not in body
    assert client.get("/api/wear/guides/cardiac").json()["dispatchConnected"] is False


def aed(i, status="OPERATIONAL", lat=10.8, verified=True):
    t = (clock.now() - timedelta(minutes=1)).isoformat() if verified else None
    return AedImport.model_validate(
        {
            "id": i,
            "name": "AED",
            "address": "a",
            "district": "Bình Thạnh",
            "latitude": lat,
            "longitude": 106.7,
            "accessInstructions": "access",
            "openingHours": "hours",
            "is24h": False,
            "status": status,
            "verifiedAt": t,
            "lastInspectedAt": t,
            "verificationSource": "src",
        }
    )


def test_aed_lookup_and_atomic_import(client, session):
    aeds.import_verified(session, [aed("near"), aed("broken", "OUT_OF_SERVICE"), aed("far", lat=11.1)])
    r = client.get("/api/aeds/nearby", params={"lat": 10.8, "lng": 106.7}).json()
    assert [a["id"] for a in r] == ["near"] and r[0]["accessInstructions"] == "access" and "is24h" in r[0]
    assert client.get("/api/aeds/nearby", params={"lat": "NaN", "lng": 106.7}).status_code == 400
    with pytest.raises(HTTPException):
        aeds.import_verified(session, [aed("good2"), aed("bad", verified=False)])
    assert [
        a["id"] for a in client.get("/api/aeds/nearby", params={"lat": 10.8, "lng": 106.7, "limit": 50}).json()
    ] == ["near"]


# ---- Phase 3 -----------------------------------------------------------------------------------
def enroll(client, skills=("CPR",), lat=10.8, lng=106.7):
    r = client.post(
        "/api/admin/responders",
        headers={"X-Admin-Token": ADMIN},
        json={
            "displayName": "Test alias",
            "contactPhone": "02800000000",
            "skills": list(skills),
            "verifiedAt": (clock.now() - timedelta(minutes=1)).isoformat(),
            "verificationSource": "src",
        },
    )
    assert r.status_code == 201, r.text
    d = r.json()
    auth = {"Authorization": f"Bearer {d['accessToken']}"}
    a = client.put(
        "/api/responders/me/availability",
        headers=auth,
        json={"available": True, "latitude": lat, "longitude": lng, "consentToLocationUse": True},
    )
    assert a.status_code == 200 and a.json()["refreshAfterSeconds"] == 120
    return d["responderId"], auth


def request_help(client, audience="ADULT"):
    return client.post(
        "/api/support-requests",
        json={
            "scenarioId": "cardiac",
            "locale": "vi",
            "audience": audience,
            "latitude": 10.8,
            "longitude": 106.7,
            "radius": 5000,
            "shareLocationWithAcceptedResponder": True,
        },
    )


def test_admin_requires_credentials_and_verification(client):
    body = {
        "displayName": "T",
        "contactPhone": "02800000000",
        "skills": ["CPR"],
        "verifiedAt": clock.now().isoformat(),
        "verificationSource": "x",
    }
    assert client.post("/api/admin/responders", json=body).status_code == 401
    ok = client.post("/api/admin/responders", headers={"X-Admin-Token": ADMIN}, json=body)
    assert ok.status_code == 201 and isinstance(ok.json()["accessToken"], str)
    assert (
        client.post(
            "/api/admin/responders", headers={"X-Admin-Token": ADMIN}, json={**body, "verifiedAt": None}
        ).status_code
        == 400
    )


def test_nearby_hides_private_data_and_requires_pediatric(client):
    enroll(client)
    pid, _ = enroll(client, ("CPR", "PEDIATRIC"), lat=10.81)
    r = client.get("/api/responders/nearby", params={"lat": 10.8, "lng": 106.7, "skill": "CPR", "audience": "CHILD"})
    assert [x["responderId"] for x in r.json()] == [pid]
    assert not any(w in r.text for w in ("latitude", "longitude", "contactPhone", "tokenHash"))


def test_support_flow_private_location(client, session):
    _, auth = enroll(client)
    created = request_help(client)
    assert created.status_code == 201
    rid, owner = created.json()["id"], {"Authorization": f"Bearer {created.json()['requesterToken']}"}
    inbox = client.get("/api/responders/me/requests", headers=auth).json()
    assert "latitude" not in inbox[0]
    acc = client.post(f"/api/support-requests/{rid}/accept", headers=auth)
    assert acc.status_code == 200 and acc.json()["latitude"] == 10.8
    st = client.get(f"/api/support-requests/{rid}", headers=owner).json()
    assert st["status"] == "ACCEPTED" and st["responder"]["contactPhone"] == "02800000000"
    assert client.post(f"/api/support-requests/{rid}/complete", headers=auth).status_code == 204
    assert client.get("/api/responders/me/requests", headers=auth).json() == []
    assert client.get(f"/api/support-requests/{rid}", headers=owner).json()["status"] == "COMPLETED"
    assert client.get("/api/alerts").json() == []


def test_consent_and_token_checks(client):
    _, auth = enroll(client)
    bad = client.post(
        "/api/support-requests",
        json={
            "scenarioId": "cardiac",
            "locale": "vi",
            "audience": "ADULT",
            "latitude": 10.8,
            "longitude": 106.7,
            "radius": 5000,
            "shareLocationWithAcceptedResponder": False,
        },
    )
    assert bad.status_code == 400
    rid = request_help(client).json()["id"]
    assert client.get(f"/api/support-requests/{rid}", headers=auth).status_code == 401
    assert client.get("/api/responders/me/requests").status_code == 401


def test_only_one_responder_can_accept(client):
    _, a = enroll(client)
    _, b = enroll(client, lat=10.81)
    rid = request_help(client).json()["id"]
    codes = sorted(client.post(f"/api/support-requests/{rid}/accept", headers=h).status_code for h in (a, b))
    assert codes == [200, 409]


def test_expiry_and_cancellation_remove_location(client):
    _, auth = enroll(client)
    c = request_help(client).json()
    rid, owner = c["id"], {"Authorization": f"Bearer {c['requesterToken']}"}
    client.post(f"/api/support-requests/{rid}/accept", headers=auth)
    assert client.delete(f"/api/support-requests/{rid}", headers=owner).status_code == 204
    assert client.get("/api/responders/me/requests", headers=auth).json() == []
    clock.advance(11 * 60)
    support.purge()
    assert client.get(f"/api/support-requests/{rid}", headers=owner).status_code == 404
    assert client.get("/api/responders/nearby", params={"lat": 10.8, "lng": 106.7, "skill": "CPR"}).json() == []


def test_rotate_and_revoke(client):
    rid, old = enroll(client)
    new = client.post(f"/api/admin/responders/{rid}/rotate-token", headers={"X-Admin-Token": ADMIN}).json()
    assert client.get("/api/responders/me/requests", headers=old).status_code == 401
    token = {"Authorization": f"Bearer {new['accessToken']}"}
    assert client.get("/api/responders/me/requests", headers=token).status_code == 200
    assert client.delete(f"/api/admin/responders/{rid}", headers={"X-Admin-Token": ADMIN}).status_code == 204
    assert client.get("/api/responders/me/requests", headers=token).status_code == 401


def test_capabilities_and_alerts(client):
    c = client.get("/api/capabilities").json()
    assert "voice" not in c["phase1"] and c["phase3"]["dispatchConnected"] is False
    assert c["phase3"]["adminConfigured"] is True
    a = client.post("/api/alerts", json={"scenarioId": "cardiac", "latitude": 10.8, "longitude": 106.7})
    assert a.status_code == 201 and a.json()["status"] == "OPEN" and a.json()["createdAt"].endswith("Z")
    assert len(client.get("/api/alerts").json()) == 1
    assert client.get("/api/scenarios").json()[0]["id"] == "cardiac"
