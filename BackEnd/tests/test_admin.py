"""Admin page API: accounts, roles, locking, and responder administration by a signed-in ADMIN."""

from datetime import timedelta

import pytest

from app.common import tokens
from app.core import clock
from app.modules.admin.promote import promote
from app.modules.auth import security
from app.modules.auth.models import Role, User
from app.modules.support.models import Responder, Skill
from app.modules.support.service import DEMO_SOURCE, Presence, support

PASSWORD = "correct horse battery"


def make_user(session, phone: str, name: str, role: Role = Role.USER, age_days: int = 0) -> User:
    now = clock.now() - timedelta(days=age_days)
    user = User(
        phone=phone,
        phone_verified_at=now,
        password_hash=security.hash_password(PASSWORD),
        display_name=name,
        role=role,
        created_at=now,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def headers(user: User) -> dict:
    return {"Authorization": f"Bearer {security.create_access_token(user.id, user.role)[0]}"}


def make_responder(session, user: User) -> Responder:
    profile = Responder(
        id=user.id,
        display_name=user.display_name or "Người hỗ trợ",
        contact_phone="0912345678",
        skills=[Skill.CPR.value, Skill.FIRST_AID.value],
        verified_at=clock.now(),
        verification_source=DEMO_SOURCE,
        token_hash=tokens.hash_token(tokens.issue()),
    )
    session.add(profile)
    session.commit()
    return profile


@pytest.fixture
def people(session):
    admin = make_user(session, "+84900000001", "Quản trị", Role.ADMIN, age_days=3)
    an = make_user(session, "+84912345678", "An Nguyễn", age_days=2)
    binh = make_user(session, "+84987654321", "Bình Trần", age_days=1)
    return admin, an, binh


def test_only_admins_get_in(client, people):
    admin, an, _ = people
    for path in ("/api/admin/users", "/api/admin/responders"):
        assert client.get(path).status_code == 401
        assert client.get(path, headers=headers(an)).status_code == 403
        assert client.get(path, headers=headers(admin)).status_code == 200
    assert client.patch(f"/api/admin/users/{an.id}", json={"role": "ADMIN"}, headers=headers(an)).status_code == 403


def test_list_and_search_users(client, people):
    admin, an, binh = people
    page = client.get("/api/admin/users", headers=headers(admin)).json()
    assert page["total"] == 3
    assert [u["displayName"] for u in page["items"]] == ["Bình Trần", "An Nguyễn", "Quản trị"]  # newest first
    first = page["items"][0]
    assert first["phone"] == "+84987654321" and first["role"] == "USER" and first["isActive"] is True

    def search(**params):
        r = client.get("/api/admin/users", params=params, headers=headers(admin)).json()
        return [u["id"] for u in r["items"]]

    assert search(q="an ng") == [an.id]  # name, case-insensitive
    assert search(q="0912 345") == [an.id]  # local phone format
    assert search(q="+8498765") == [binh.id]
    assert search(role="ADMIN") == [admin.id]
    client.patch(f"/api/admin/users/{binh.id}", json={"isActive": False}, headers=headers(admin))
    assert search(active="false") == [binh.id]
    assert search(active="true", role="USER") == [an.id]
    assert search(q="không có ai") == []
    assert search(limit=1, offset=1) == [an.id]


def test_promote_and_demote(client, people):
    admin, an, _ = people
    r = client.patch(f"/api/admin/users/{an.id}", json={"role": "ADMIN"}, headers=headers(admin))
    assert r.status_code == 200 and r.json()["role"] == "ADMIN"
    assert client.get("/api/auth/me", headers=headers(an)).json()["role"] == "ADMIN"
    assert client.get("/api/admin/users", headers=headers(an)).status_code == 200

    # the new admin can demote the first one, but nobody can change their own role
    assert client.patch(f"/api/admin/users/{an.id}", json={"role": "USER"}, headers=headers(an)).status_code == 400
    r = client.patch(f"/api/admin/users/{admin.id}", json={"role": "USER"}, headers=headers(an))
    assert r.status_code == 200 and r.json()["role"] == "USER"
    assert client.get("/api/admin/users", headers=headers(admin)).status_code == 403


def test_lock_signs_out_and_unlock(client, session, people):
    admin, an, _ = people
    login = client.post("/api/auth/token", data={"username": "0912345678", "password": PASSWORD})
    refresh = login.json()["refresh_token"]

    assert (
        client.patch(f"/api/admin/users/{admin.id}", json={"isActive": False}, headers=headers(admin)).status_code
        == 400
    )
    r = client.patch(f"/api/admin/users/{an.id}", json={"isActive": False}, headers=headers(admin))
    assert r.status_code == 200 and r.json()["isActive"] is False
    assert client.get("/api/auth/me", headers=headers(an)).status_code == 401
    assert client.post("/api/auth/refresh", json={"refreshToken": refresh}).status_code == 401
    login = client.post("/api/auth/token", data={"username": "0912345678", "password": PASSWORD})
    assert login.status_code == 403

    client.patch(f"/api/admin/users/{an.id}", json={"isActive": True}, headers=headers(admin))
    assert client.post("/api/auth/token", data={"username": "0912345678", "password": PASSWORD}).status_code == 200


def test_unknown_user(client, people):
    admin = people[0]
    assert client.patch("/api/admin/users/nope", json={"role": "ADMIN"}, headers=headers(admin)).status_code == 404


def test_manage_responders(client, session, people):
    admin, an, _ = people
    make_responder(session, an)
    support.presence[an.id] = Presence(10.77, 106.70, clock.now() + timedelta(minutes=5))

    [row] = client.get("/api/admin/responders", headers=headers(admin)).json()
    assert row["id"] == an.id and row["verified"] is True and row["online"] is True
    assert row["account"]["phone"] == "+84912345678" and row["skills"] == ["CPR", "FIRST_AID"]
    assert client.get("/api/admin/users", params={"q": "An"}, headers=headers(admin)).json()["items"][0]["isResponder"]

    # suspend: off duty right away, and the responder app is refused
    r = client.patch(f"/api/admin/responders/{an.id}", json={"verified": False}, headers=headers(admin))
    assert r.status_code == 200 and r.json()["verified"] is False and r.json()["online"] is False
    assert an.id not in support.presence

    r = client.patch(
        f"/api/admin/responders/{an.id}", json={"verified": True, "skills": ["AED"]}, headers=headers(admin)
    )
    body = r.json()
    assert body["verified"] is True and body["skills"] == ["AED"] and body["verificationSource"] != DEMO_SOURCE
    assert (
        client.patch(f"/api/admin/responders/{an.id}", json={"skills": []}, headers=headers(admin)).status_code == 400
    )

    # delete: a signed-in admin is enough; a plain user without the admin token is not
    assert client.delete(f"/api/admin/responders/{an.id}", headers=headers(an)).status_code == 401
    assert client.delete(f"/api/admin/responders/{an.id}", headers=headers(admin)).status_code == 204
    assert client.get("/api/admin/responders", headers=headers(admin)).json() == []
    assert (
        client.patch(f"/api/admin/responders/{an.id}", json={"verified": True}, headers=headers(admin)).status_code
        == 404
    )


def test_promote_command(session, people):
    _, an, _ = people
    assert promote("0912 345 678") == "+84912345678 is now an administrator."
    session.refresh(an)
    assert an.role == Role.ADMIN
    assert promote("0999999999").startswith("No account")
    assert promote("not a login").startswith("Not a phone number")


def test_access_token_carries_the_role_for_the_proxy(client, people):
    import jwt

    admin, an, _ = people

    def role_after_login(phone):
        token = client.post("/api/auth/token", data={"username": phone, "password": PASSWORD}).json()["access_token"]
        return jwt.decode(token, options={"verify_signature": False})["role"]

    assert role_after_login("0900000001") == "ADMIN"
    assert role_after_login("0912345678") == "USER"
    client.patch(f"/api/admin/users/{an.id}", json={"role": "ADMIN"}, headers=headers(admin))
    assert role_after_login("0912345678") == "ADMIN"
