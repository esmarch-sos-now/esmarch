"""Accounts live in Supabase Auth; sign-up, sign-in and passwords happen there. The backend checks tokens and keeps
each account's role and lock (`accounts`)."""

from fastapi import APIRouter, Depends

from app.modules.auth.deps import CurrentUser, require_auth_configured
from app.modules.auth.models import Role
from app.modules.auth.schemas import UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"], dependencies=[Depends(require_auth_configured)])


@router.get("/me")
def me(user: CurrentUser) -> UserOut:
    """The user the bearer token belongs to, as the backend sees it (role included)."""
    return UserOut(
        id=user.id,
        phone=user.phone,
        email=user.email,
        display_name=user.display_name,
        role=Role.ADMIN if user.is_admin else Role.USER,
    )
