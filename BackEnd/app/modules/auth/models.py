"""What the backend keeps about a Supabase account: its role and whether it is locked.

Sign-up, sign-in and passwords live in Supabase Auth. An `Account` row is created the first time the backend sees a
valid access token for that user (and its phone, email and name are refreshed from later tokens), so the admin page
can list and search accounts. The role and the lock are decided here, never by a token claim.
"""

from datetime import datetime
from enum import StrEnum

from sqlmodel import Field, SQLModel

from app.common.columns import tstz


class Role(StrEnum):
    USER = "USER"
    ADMIN = "ADMIN"  # can open /admin: manage accounts, roles and responders


class Account(SQLModel, table=True):
    __tablename__ = "accounts"  # pyrefly: ignore[bad-override]

    id: str = Field(primary_key=True, max_length=36)  # Supabase auth.users.id (the token's `sub`)
    phone: str | None = Field(default=None, max_length=16, index=True)  # E.164, e.g. +84912345678
    email: str | None = Field(default=None, max_length=254)
    display_name: str | None = Field(default=None, max_length=100)
    role: str = Field(default=Role.USER, max_length=10)
    is_active: bool = True
    created_at: datetime = Field(sa_column=tstz(nullable=False, index=True))

    @property
    def is_admin(self) -> bool:
        return self.role == Role.ADMIN
