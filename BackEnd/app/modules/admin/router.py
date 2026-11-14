"""Admin page API: accounts and roles. Responder administration lives with the support module (/api/admin/responders).

Every route needs a signed-in account with the ADMIN role (see `python -m app.modules.admin.promote` for the first one).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.modules.admin import service
from app.modules.admin.schemas import AdminUserView, UserPage, UserUpdate
from app.modules.auth.deps import AdminUser, Db, require_auth_configured
from app.modules.auth.models import Role

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_auth_configured)])


@router.get("/users")
def list_users(
    session: Db,
    admin: AdminUser,
    q: Annotated[str | None, Query(max_length=100)] = None,
    role: Role | None = None,
    active: bool | None = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> UserPage:
    """Accounts, newest first; `q` searches the name, email and phone number; `active=false` lists locked ones."""
    return service.list_users(session, q, role, active, offset, limit)


@router.patch("/users/{user_id}")
def update_user(user_id: str, body: UserUpdate, session: Db, admin: AdminUser) -> AdminUserView:
    """Changes the role (USER/ADMIN) or locks/unlocks an account. Not allowed on your own account."""
    return service.update_user(session, admin, user_id, body.role, body.is_active)
