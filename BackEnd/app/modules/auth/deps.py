"""Request dependencies: the Supabase access token arrives as `Authorization: Bearer <token>`.

A valid token is not enough: the account must not be locked on the admin page, and the role comes from the database
(`accounts`), checked on every request.
"""

from dataclasses import replace
from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.dialects.postgresql import insert
from sqlmodel import Session

from app.core import clock
from app.core.config import get_settings
from app.core.db import get_session
from app.core.errors import error
from app.modules.auth.models import Account, Role
from app.modules.auth.security import AuthUser, verify_access_token

# auto_error=False: missing credentials go through the same 401 (with WWW-Authenticate) as invalid ones.
bearer_scheme = HTTPBearer(auto_error=False, description="Supabase Auth access token")
Credentials = Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)]
Db = Annotated[Session, Depends(get_session)]


def require_auth_configured() -> None:
    if not get_settings().auth_configured:
        raise error(503, "Accounts are not configured.")


def account_for(session: Session, user: AuthUser) -> Account:
    """The account row of a verified user, created on first sight and kept in step with the token's profile."""
    account = session.get(Account, user.id)
    if account is None:
        session.execute(  # two first requests at once must not both fail on the primary key
            insert(Account)
            .values(
                id=user.id,
                phone=user.phone,
                email=user.email,
                display_name=user.display_name,
                role=Role.USER,
                is_active=True,
                created_at=clock.now(),
            )
            .on_conflict_do_nothing(index_elements=["id"])
        )
        session.commit()
        account = session.get(Account, user.id)
        assert account is not None
        return account
    profile = {"phone": user.phone, "email": user.email, "display_name": user.display_name}
    if any(getattr(account, k) != v for k, v in profile.items()):
        for k, v in profile.items():
            setattr(account, k, v)
        session.commit()
    return account


def get_optional_user(credentials: Credentials, session: Db) -> AuthUser | None:
    if credentials is None or not get_settings().auth_configured:
        return None
    user = verify_access_token(credentials.credentials)
    if user is None:
        return None
    account = account_for(session, user)
    if not account.is_active:  # locked on the admin page: treated as signed out, whatever Supabase says
        return None
    return replace(user, is_admin=account.is_admin)


def get_current_user(user: Annotated[AuthUser | None, Depends(get_optional_user)]) -> AuthUser:
    if user is None:
        raise HTTPException(401, "Could not validate credentials.", {"WWW-Authenticate": "Bearer"})
    return user


def get_admin_user(user: Annotated[AuthUser, Depends(get_current_user)]) -> AuthUser:
    """A signed-in account with the ADMIN role (read from the database just now); 403 for everyone else."""
    if not user.is_admin:
        raise error(403, "Administrator access required.")
    return user


OptionalUser = Annotated[AuthUser | None, Depends(get_optional_user)]
CurrentUser = Annotated[AuthUser, Depends(get_current_user)]
AdminUser = Annotated[AuthUser, Depends(get_admin_user)]
