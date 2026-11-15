"""Request dependencies: the Supabase access token arrives as `Authorization: Bearer <token>`."""

from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings
from app.core.errors import error
from app.modules.auth.security import AuthUser, verify_access_token

# auto_error=False: missing credentials go through the same 401 (with WWW-Authenticate) as invalid ones.
bearer_scheme = HTTPBearer(auto_error=False, description="Supabase Auth access token")
Credentials = Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)]


def require_auth_configured() -> None:
    if not get_settings().auth_configured:
        raise error(503, "Accounts are not configured.")


def get_optional_user(credentials: Credentials) -> AuthUser | None:
    if credentials is None or not get_settings().auth_configured:
        return None
    return verify_access_token(credentials.credentials)


def get_current_user(user: Annotated[AuthUser | None, Depends(get_optional_user)]) -> AuthUser:
    if user is None:
        raise HTTPException(401, "Could not validate credentials.", {"WWW-Authenticate": "Bearer"})
    return user


OptionalUser = Annotated[AuthUser | None, Depends(get_optional_user)]
CurrentUser = Annotated[AuthUser, Depends(get_current_user)]
