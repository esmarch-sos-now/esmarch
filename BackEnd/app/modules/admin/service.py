"""Account administration for the admin page: list and search accounts, change roles, lock and unlock.

Accounts are the `accounts` rows the backend keeps for Supabase users (see `app.modules.auth.models`): one appears the
first time its user calls the backend while signed in. An administrator cannot change their own role or lock
themselves out, so there is always at least one admin left.

Locking takes effect at once: every backend request of that account is refused from then on (the lock is checked in
the database, not in the token), its responder profile goes off duty, and with a service key Supabase also bans the
user so it cannot sign in or refresh its session. The role is copied to the user's `app_metadata` (writable only with
the service key) so the frontend can send admins to /admin; the backend never trusts that copy.
"""

import logging
import re

from sqlalchemy import ColumnElement, func, or_
from sqlmodel import Session, col, select

from app.core.errors import error
from app.core.supabase import AuthAdminError, update_auth_user
from app.modules.admin.schemas import AdminUserView, UserPage
from app.modules.auth.models import Account, Role
from app.modules.auth.security import AuthUser
from app.modules.support.models import Responder
from app.modules.support.service import support

log = logging.getLogger(__name__)

SELF_CHANGE = "You cannot change your own role or lock your own account."
BAN_FOREVER = "876000h"  # Supabase takes a duration; about 100 years


def _view(account: Account, responder_ids: set[str]) -> AdminUserView:
    return AdminUserView(
        id=account.id,
        phone=account.phone,
        email=account.email,
        display_name=account.display_name,
        role=Role(account.role),
        is_active=account.is_active,
        verified=True,  # Supabase only signs in accounts that confirmed their phone number
        is_responder=account.id in responder_ids,
        created_at=account.created_at,
    )


def _responder_ids(session: Session, ids: list[str]) -> set[str]:
    if not ids:
        return set()
    return set(session.exec(select(Responder.id).where(col(Responder.id).in_(ids))).all())


def list_users(
    session: Session, query: str | None, role: Role | None, active: bool | None, offset: int, limit: int
) -> UserPage:
    """Newest first. `query` matches the name, email or phone number (0912… also finds +84912…)."""
    conditions: list[ColumnElement[bool]] = []
    if role is not None:
        conditions.append(col(Account.role) == role)
    if active is not None:
        conditions.append(col(Account.is_active) == active)
    q = re.sub(r"\s+", " ", query or "").strip()
    if q:
        like = f"%{q.replace('%', '').replace('_', '')}%"
        matches: list[ColumnElement[bool]] = [
            col(Account.display_name).ilike(like),
            col(Account.email).ilike(like),
            col(Account.phone).ilike(like),
        ]
        digits = re.sub(r"[\s.()-]", "", q)
        if digits.startswith("0") and digits[1:].isdigit():  # a local number typed as 09…: stored as +849…
            matches.append(col(Account.phone).like(f"%+84{digits[1:]}%"))
        conditions.append(or_(*matches))
    total = session.exec(select(func.count()).select_from(Account).where(*conditions)).one()
    accounts = session.exec(
        select(Account)
        .where(*conditions)
        .order_by(col(Account.created_at).desc(), col(Account.id))
        .offset(offset)
        .limit(limit)
    ).all()
    responders = _responder_ids(session, [a.id for a in accounts])
    return UserPage(items=[_view(a, responders) for a in accounts], total=total)


def _sync_supabase(account: Account, attributes: dict) -> None:
    try:
        update_auth_user(account.id, attributes)
    except AuthAdminError:
        # The database already holds the change and the backend enforces it; Supabase catches up on the next edit.
        log.warning("could not update Supabase Auth user for an admin change", exc_info=True)


def update_user(
    session: Session, admin: AuthUser, user_id: str, role: Role | None, is_active: bool | None
) -> AdminUserView:
    account = session.get(Account, user_id)
    if account is None:
        raise error(404, "User not found.")
    changes_self = (role is not None and role != account.role) or (is_active is False)
    if account.id == admin.id and changes_self:
        raise error(400, SELF_CHANGE)
    attributes: dict = {}
    if role is not None and role != account.role:
        account.role = role
        attributes["app_metadata"] = {"role": role.value}
    if is_active is not None and is_active != account.is_active:
        account.is_active = is_active
        attributes["ban_duration"] = "none" if is_active else BAN_FOREVER
        if not is_active:
            support.withdraw(session, account.id)
    session.commit()
    if attributes:
        _sync_supabase(account, attributes)
    return _view(account, _responder_ids(session, [account.id]))
