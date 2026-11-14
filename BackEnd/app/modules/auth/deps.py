from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session

from app.core.config import get_settings
from app.core.db import get_session
from app.core.errors import error
from app.modules.auth.models import User
from app.modules.auth.security import decode_access_token

# auto_error=False: missing credentials go through the same 401 (with WWW-Authenticate) as invalid ones.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)
Token = Annotated[str | None, Depends(oauth2_scheme)]
Db = Annotated[Session, Depends(get_session)]


def require_auth_configured() -> None:
    if not get_settings().auth_configured:
        raise error(503, "Accounts are not configured.")


def _unauthorized() -> HTTPException:
    return HTTPException(401, "Could not validate credentials.", {"WWW-Authenticate": "Bearer"})


def get_optional_user(session: Db, token: Token) -> User | None:
    if token is None or not get_settings().auth_configured:
        return None
    user_id = decode_access_token(token)
    user = session.get(User, user_id) if user_id else None
    if user is None or not user.is_active or not user.verified:
        return None
    return user


def get_current_user(user: Annotated[User | None, Depends(get_optional_user)]) -> User:
    if user is None:
        raise _unauthorized()
    return user


def get_admin_user(user: Annotated[User, Depends(get_current_user)]) -> User:
    """A signed-in account with the ADMIN role; 403 for everyone else."""
    if not user.is_admin:
        raise error(403, "Administrator access required.")
    return user


OptionalUser = Annotated[User | None, Depends(get_optional_user)]
CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(get_admin_user)]
