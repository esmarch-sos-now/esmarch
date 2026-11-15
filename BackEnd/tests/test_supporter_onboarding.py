"""Becoming a responder: finish the courses, apply, wait for an admin, then supporter mode."""

import uuid

import pytest

from app.common import tokens
from app.core import clock
from app.modules.auth.models import Account, Role
from app.modules.courses.content import COURSES
from app.modules.support.models import Responder, Skill
from tests.auth_tokens import bearer
from tests.helpers import approve, finish_courses

HERE = {"available": True, "latitude": 10.8, "longitude": 106.7, "consentToLocationUse": True}
APPLY = {"displayName": "Hải", "commitment": True, "email": "Hai@Example.com"}


def user_id(email: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, email))


def user(email: str = "hai@example.com", **claims) -> dict:
    return bearer(user_id=user_id(email), email=email, name="Hải", **claims)


def me(client, auth: dict) -> dict:
    r = client.get("/api/support/me", headers=auth)
    assert r.status_code == 200, r.text
    return r.json()


def apply(client, auth: dict, body=APPLY):
    return client.post("/api/support/me/application", headers=auth, json=body)


@pytest.fixture
def admin(session) -> dict:
    account = Account(
        id=str(uuid.uuid4()), phone="+84900000001", display_name="Quản trị", role=Role.ADMIN, created_at=clock.now()
    )
    session.add(account)
    session.commit()
    return bearer(user_id=account.id, phone="84900000001", name="Quản trị")


def test_status_follows_the_courses_until_the_user_may_apply(client):
    auth = user()
    first = me(client, auth)
    assert first["status"] == "none" and first["accountPhone"] == "+84912345678"
    progress = first["courseProgress"]
    assert progress["done"] == 0 and progress["total"] == sum(len(c.lessons) for c in COURSES)
    assert [c["id"] for c in progress["courses"]] == [c.id for c in COURSES] and progress["complete"] is False
    assert progress["courses"][0]["nextLessonId"] == COURSES[0].lessons[0].id

    finish_courses(user_id("hai@example.com"), COURSES[:1])
    learning = me(client, auth)
    assert learning["status"] == "learning" and learning["courseProgress"]["done"] == len(COURSES[0].lessons)
    assert apply(client, auth).status_code == 409  # one course left

    finish_courses(user_id("hai@example.com"))
    ready = me(client, auth)
    assert ready["status"] == "ready" and ready["courseProgress"]["complete"] is True
    assert "displayName" not in ready  # no profile yet


def test_application_waits_for_an_admin_and_cannot_take_requests(client):
    auth = user()
    me(client, auth)
    finish_courses(user_id("hai@example.com"))
    assert apply(client, auth, {"displayName": "Hải"}).status_code == 400  # the commitment box is required

    r = apply(client, auth)
    assert r.status_code == 200, r.text
    pending = r.json()
    assert pending["status"] == "pending" and pending["contactPhone"] == "+84912345678" and pending["appliedAt"]
    assert pending["displayName"] == "Hải" and pending["available"] is False
    assert apply(client, auth).json()["status"] == "pending"  # applying again changes nothing

    assert client.put("/api/support/me/availability", headers=auth, json=HERE).status_code == 403
    assert client.get("/api/support/me/requests", headers=auth).status_code == 403


def test_an_account_without_a_verified_phone_cannot_apply(client):
    auth = user(phone="")
    me(client, auth)
    finish_courses(user_id("hai@example.com"))
    assert apply(client, auth).status_code == 409


def test_admin_reviews_approves_suspends_and_rejects(client, admin):
    auth = user()
    me(client, auth)
    finish_courses(user_id("hai@example.com"))
    apply(client, auth)
    rid = user_id("hai@example.com")

    [row] = client.get("/api/admin/responders", headers=admin).json()
    assert row["status"] == "pending" and row["verified"] is False and row["appliedAt"]
    assert [c["id"] for c in row["completedCourses"]] == [c.id for c in COURSES]
    assert "airway-choking" in row["verificationSource"]

    approved = client.patch(f"/api/admin/responders/{rid}", json={"verified": True}, headers=admin).json()
    assert approved["status"] == "verified"
    assert me(client, auth)["status"] == "verified"
    assert client.put("/api/support/me/availability", headers=auth, json=HERE).json()["available"] is True
    assert apply(client, auth).status_code == 409  # already a responder

    client.patch(f"/api/admin/responders/{rid}", json={"verified": False}, headers=admin)
    suspended = me(client, auth)
    assert suspended["status"] == "suspended" and suspended["available"] is False
    assert apply(client, auth).status_code == 403  # suspension is not undone by applying again

    client.patch(f"/api/admin/responders/{rid}", json={"verified": True}, headers=admin)
    assert me(client, auth)["status"] == "verified"

    assert client.delete(f"/api/admin/responders/{rid}", headers=admin).status_code == 204  # reject / remove
    assert me(client, auth)["status"] == "ready"  # the courses still count: may apply again


def test_a_former_demo_enrolment_starts_over(client, session, admin):
    """Profiles from the old demo self-enrolment are unverified by the migration and have never applied."""
    auth = user()
    me(client, auth)
    rid = user_id("hai@example.com")
    session.add(
        Responder(
            id=rid,
            display_name="Hải",
            contact_phone="0903000111",
            skills=[Skill.FIRST_AID.value],
            verification_source="Demo self-enrolment (SUPPORT_DEMO_SELF_ENROLL); qualification not verified",
            token_hash=tokens.hash_token(tokens.issue()),
        )
    )
    session.commit()
    assert me(client, auth)["status"] == "none"
    assert client.get("/api/admin/responders", headers=admin).json() == []  # nothing to review
    finish_courses(rid)
    assert apply(client, auth).json()["status"] == "pending"
    approve(rid)
    assert me(client, auth)["status"] == "verified"
