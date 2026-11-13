"""Account administration for the admin page: list and search accounts, change roles, lock and unlock.

An administrator cannot change their own role or lock themselves out, so there is always at least one admin left.
Locking an account signs it out everywhere and takes its responder profile (if any) off duty.
"""

import re

from sqlalchemy import ColumnElement, func, or_
from sqlmodel import Session, col, select, update

from app.core import clock
from app.core.errors import error
from app.modules.admin.schemas import AdminUserView, UserPage
from app.modules.auth.models import RefreshToken, Role, User
from app.modules.support.models import Responder
from app.modules.support.service import support

SELF_CHANGE = "You cannot change your own role or lock your own account."


def _view(user: User, responder_ids: set[str]) -> AdminUserView:
    return AdminUserView(
        id=user.id,
        phone=user.phone,
        email=user.email,
        display_name=user.display_name,
        role=Role(user.role),
        is_active=user.is_active,
        verified=user.verified,
        is_responder=user.id in responder_ids,
        created_at=user.created_at,
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
        conditions.append(col(User.role) == role)
    if active is not None:
        conditions.append(col(User.is_active) == active)
    q = re.sub(r"\s+", " ", query or "").strip()
    if q:
        like = f"%{q.replace('%', '').replace('_', '')}%"
        matches: list[ColumnElement[bool]] = [
            col(User.display_name).ilike(like),
            col(User.email).ilike(like),
            col(User.phone).ilike(like),
        ]
        digits = re.sub(r"[\s.()-]", "", q)
        if digits.startswith("0") and digits[1:].isdigit():  # a local number typed as 09…: stored as +849…
            matches.append(col(User.phone).like(f"%+84{digits[1:]}%"))
        conditions.append(or_(*matches))
    total = session.exec(select(func.count()).select_from(User).where(*conditions)).one()
    users = session.exec(
        select(User).where(*conditions).order_by(col(User.created_at).desc(), col(User.id)).offset(offset).limit(limit)
    ).all()
    responders = _responder_ids(session, [u.id for u in users])
    return UserPage(items=[_view(u, responders) for u in users], total=total)


def update_user(
    session: Session, admin: User, user_id: str, role: Role | None, is_active: bool | None
) -> AdminUserView:
    user = session.get(User, user_id)
    if user is None:
        raise error(404, "User not found.")
    changes_self = (role is not None and role != user.role) or (is_active is False)
    if user.id == admin.id and changes_self:
        raise error(400, SELF_CHANGE)
    if role is not None:
        user.role = role
    if is_active is not None and is_active != user.is_active:
        user.is_active = is_active
        if not is_active:  # sign out every session and take the responder profile off duty
            session.exec(
                update(RefreshToken)
                .where(col(RefreshToken.user_id) == user.id, col(RefreshToken.revoked_at).is_(None))
                .values(revoked_at=clock.now())
            )
            with support.lock:
                support.withdraw(user.id)
    session.commit()
    return _view(user, _responder_ids(session, [user.id]))
