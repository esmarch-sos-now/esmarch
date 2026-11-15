"""Accounts live in Supabase Auth; sign-up, sign-in and passwords happen there. The backend only checks tokens."""

from fastapi import APIRouter, Depends

from app.modules.auth.deps import CurrentUser, require_auth_configured
from app.modules.auth.schemas import UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"], dependencies=[Depends(require_auth_configured)])


@router.get("/me")
def me(user: CurrentUser) -> UserOut:
    """The user the bearer token belongs to, as the backend sees it."""
    return UserOut(id=user.id, phone=user.phone, email=user.email, display_name=user.display_name)
