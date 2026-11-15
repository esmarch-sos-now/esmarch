"""Admin page API: accounts, roles, locking, and responder administration by a signed-in ADMIN.

Accounts are Supabase users; the backend keeps their role and lock in `accounts` and checks both on every request.
"""

import uuid
from datetime import timedelta

import pytest

from app.common import tokens
from app.core import clock
from app.modules.admin import service as admin_service
from app.modules.admin.promote import promote
from app.modules.auth.models import Account, Role
from app.modules.support.models import Presence, Responder, Skill
from tests.auth_tokens import bearer


def make_account(session, phone: str, name: str, role: Role = Role.USER, age_days: int = 0) -> Account:
    account = Account(
        id=str(uuid.uuid4()),
        phone=phone,
        display_name=name,
        role=role,
        created_at=clock.now() - timedelta(days=age_days),
    )
    session.add(account)
    session.commit()
    session.refresh(account)
    return account


def headers(account: Account, **claims) -> dict:
    return bearer(user_id=account.id, phone=(account.phone or "").lstrip("+"), name=account.display_name, **claims)


def make_responder(session, account: Account) -> Responder:
    profile = Responder(
        id=account.id,
        display_name=account.display_name or "Người hỗ trợ",
        contact_phone="0912345678",
        skills=[Skill.CPR.value, Skill.FIRST_AID.value],
        verified_at=clock.now(),
        verification_source="Verified by an administrator (test fixture)",
        token_hash=tokens.hash_token(tokens.issue()),
    )
    session.add(profile)
    session.commit()
    return profile


@pytest.fixture
def people(session):
    admin = make_account(session, "+84900000001", "Quản trị", Role.ADMIN, age_days=3)
    an = make_account(session, "+84912345678", "An Nguyễn", age_days=2)
    binh = make_account(session, "+84987654321", "Bình Trần", age_days=1)
    return admin, an, binh


@pytest.fixture
def supabase_calls(monkeypatch):
    calls: list[tuple[str, dict]] = []
    monkeypatch.setattr(admin_service, "update_auth_user", lambda uid, attrs: calls.append((uid, attrs)) or True)
    return calls


def test_first_sign_in_creates_a_plain_account(client, session):
    uid = str(uuid.uuid4())
    me = client.get("/api/auth/me", headers=bearer(user_id=uid, name="Chi"))
    assert me.status_code == 200 and me.json()["role"] == "USER"
    account = session.get(Account, uid)
    assert account is not None and account.phone == "+84912345678" and account.display_name == "Chi"
    # later tokens refresh the profile, never the role
    client.get("/api/auth/me", headers=bearer(user_id=uid, name="Chi Lê", phone="84911111111"))
    session.refresh(account)
    assert account.display_name == "Chi Lê" and account.phone == "+84911111111" and account.role == Role.USER


def test_token_claims_cannot_make_an_admin(client, people):
    _, an, _ = people
    forged = {"app_metadata": {"role": "ADMIN"}, "user_metadata": {"role": "ADMIN", "display_name": "An"}}
    assert client.get("/api/admin/users", headers=headers(an, **forged)).status_code == 403
    assert client.get("/api/auth/me", headers=headers(an, **forged)).json()["role"] == "USER"


def test_only_admins_get_in(client, people):
    admin, an, _ = people
    for path in ("/api/admin/users", "/api/admin/responders"):
        assert client.get(path).status_code == 401
        assert client.get(path, headers=headers(an)).status_code == 403
        assert client.get(path, headers=headers(admin)).status_code == 200
    assert client.patch(f"/api/admin/users/{an.id}", json={"role": "ADMIN"}, headers=headers(an)).status_code == 403


def test_list_and_search_users(client, people, supabase_calls):
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


def test_promote_and_demote(client, people, supabase_calls):
    admin, an, _ = people
    r = client.patch(f"/api/admin/users/{an.id}", json={"role": "ADMIN"}, headers=headers(admin))
    assert r.status_code == 200 and r.json()["role"] == "ADMIN"
    assert supabase_calls == [(an.id, {"app_metadata": {"role": "ADMIN"}})]
    # takes effect on the next request, with the same token
    assert client.get("/api/auth/me", headers=headers(an)).json()["role"] == "ADMIN"
    assert client.get("/api/admin/users", headers=headers(an)).status_code == 200

    # the new admin can demote the first one, but nobody can change their own role
    assert client.patch(f"/api/admin/users/{an.id}", json={"role": "USER"}, headers=headers(an)).status_code == 400
    r = client.patch(f"/api/admin/users/{admin.id}", json={"role": "USER"}, headers=headers(an))
    assert r.status_code == 200 and r.json()["role"] == "USER"
    assert client.get("/api/admin/users", headers=headers(admin)).status_code == 403


def test_lock_and_unlock(client, session, people, supabase_calls):
    admin, an, _ = people
    make_responder(session, an)
    session.add(Presence(responder_id=an.id, latitude=10.77, longitude=106.70, expires_at=clock.now() + timedelta(1)))
    session.commit()

    r = client.patch(f"/api/admin/users/{admin.id}", json={"isActive": False}, headers=headers(admin))
    assert r.status_code == 400
    r = client.patch(f"/api/admin/users/{an.id}", json={"isActive": False}, headers=headers(admin))
    assert r.status_code == 200 and r.json()["isActive"] is False
    assert supabase_calls[-1] == (an.id, {"ban_duration": admin_service.BAN_FOREVER})
    # the still-valid Supabase token is refused at once, and the responder is off duty
    assert client.get("/api/auth/me", headers=headers(an)).status_code == 401
    assert client.get("/api/support/me", headers=headers(an)).status_code == 401
    session.expire_all()
    assert session.get(Presence, an.id) is None

    client.patch(f"/api/admin/users/{an.id}", json={"isActive": True}, headers=headers(admin))
    assert supabase_calls[-1] == (an.id, {"ban_duration": "none"})
    assert client.get("/api/auth/me", headers=headers(an)).status_code == 200


def test_supabase_failure_keeps_the_lock(client, people, monkeypatch):
    from app.core.supabase import AuthAdminError

    admin, an, _ = people

    def fail(uid, attrs):
        raise AuthAdminError("down")

    monkeypatch.setattr(admin_service, "update_auth_user", fail)
    r = client.patch(f"/api/admin/users/{an.id}", json={"isActive": False}, headers=headers(admin))
    assert r.status_code == 200
    assert client.get("/api/auth/me", headers=headers(an)).status_code == 401


def test_unknown_user(client, people):
    admin = people[0]
    assert client.patch("/api/admin/users/nope", json={"role": "ADMIN"}, headers=headers(admin)).status_code == 404


def test_manage_responders(client, session, people):
    admin, an, _ = people
    make_responder(session, an)
    session.add(Presence(responder_id=an.id, latitude=10.77, longitude=106.70, expires_at=clock.now() + timedelta(1)))
    session.commit()

    [row] = client.get("/api/admin/responders", headers=headers(admin)).json()
    assert row["id"] == an.id and row["verified"] is True and row["status"] == "verified" and row["online"] is True
    assert row["account"]["phone"] == "+84912345678" and row["skills"] == ["CPR", "FIRST_AID"]
    assert client.get("/api/admin/users", params={"q": "An"}, headers=headers(admin)).json()["items"][0]["isResponder"]

    # suspend: off duty right away, and the responder app is refused
    r = client.patch(f"/api/admin/responders/{an.id}", json={"verified": False}, headers=headers(admin))
    assert r.status_code == 200 and r.json()["verified"] is False and r.json()["online"] is False
    assert r.json()["status"] == "suspended"
    session.expire_all()
    assert session.get(Presence, an.id) is None
    assert client.get("/api/support/me/requests", headers=headers(an)).status_code == 403

    r = client.patch(
        f"/api/admin/responders/{an.id}", json={"verified": True, "skills": ["AED"]}, headers=headers(admin)
    )
    body = r.json()
    assert body["verified"] is True and body["status"] == "verified" and body["skills"] == ["AED"]
    assert (
        client.patch(f"/api/admin/responders/{an.id}", json={"skills": []}, headers=headers(admin)).status_code == 400
    )

    # delete: a signed-in admin is enough; a plain user without the admin token is not
    assert client.delete(f"/api/admin/responders/{an.id}", headers=headers(an)).status_code in (401, 503)
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
    assert promote("not a login").startswith("Not a Vietnamese mobile number")
