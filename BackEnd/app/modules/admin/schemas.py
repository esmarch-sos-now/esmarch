from datetime import datetime

from app.common.schemas import CamelModel
from app.modules.auth.models import Role


class AdminUserView(CamelModel):
    id: str
    phone: str | None
    email: str | None
    display_name: str | None
    role: Role
    is_active: bool
    verified: bool
    is_responder: bool
    created_at: datetime


class UserPage(CamelModel):
    items: list[AdminUserView]
    total: int


class UserUpdate(CamelModel):
    """Only the fields that are sent change."""

    role: Role | None = None
    is_active: bool | None = None
