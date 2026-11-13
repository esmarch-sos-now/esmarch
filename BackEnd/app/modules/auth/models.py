import uuid
from datetime import datetime
from enum import StrEnum

from sqlmodel import Field, SQLModel

from app.common.columns import tstz


def _uuid() -> str:
    return str(uuid.uuid4())


class Role(StrEnum):
    USER = "USER"
    ADMIN = "ADMIN"  # can open /admin: manage accounts, roles and responders


class User(SQLModel, table=True):
    __tablename__ = "users"  # pyrefly: ignore[bad-override]

    id: str = Field(default_factory=_uuid, primary_key=True, max_length=36)
    # Accounts sign up with a phone number checked by Firebase SMS OTP; email accounts are the older flow.
    email: str | None = Field(default=None, max_length=254, unique=True)  # normalized, lower-cased
    phone: str | None = Field(default=None, max_length=16, unique=True)  # E.164, e.g. +84912345678
    password_hash: str = Field(max_length=255)
    display_name: str | None = Field(default=None, max_length=100)
    is_active: bool = True
    role: str = Field(default=Role.USER, max_length=10)
    email_verified_at: datetime | None = Field(default=None, sa_column=tstz())
    phone_verified_at: datetime | None = Field(default=None, sa_column=tstz())
    created_at: datetime = Field(sa_column=tstz(nullable=False))

    @property
    def verified(self) -> bool:
        """The account proved it owns its phone number (or, for older accounts, its mailbox)."""
        return self.phone_verified_at is not None or self.email_verified_at is not None

    @property
    def is_admin(self) -> bool:
        return self.role == Role.ADMIN


class RefreshToken(SQLModel, table=True):
    """One row per issued refresh token. Rotation marks the old row used; a family is one login session."""

    __tablename__ = "refresh_tokens"  # pyrefly: ignore[bad-override]

    id: str = Field(default_factory=_uuid, primary_key=True, max_length=36)
    user_id: str = Field(foreign_key="users.id", ondelete="CASCADE", index=True, max_length=36)
    family_id: str = Field(index=True, max_length=36)
    token_hash: str = Field(max_length=64, unique=True)
    created_at: datetime = Field(sa_column=tstz(nullable=False))
    expires_at: datetime = Field(sa_column=tstz(nullable=False))
    used_at: datetime | None = Field(default=None, sa_column=tstz())
    revoked_at: datetime | None = Field(default=None, sa_column=tstz())


class CodePurpose(StrEnum):
    VERIFY_EMAIL = "VERIFY_EMAIL"
    RESET_PASSWORD = "RESET_PASSWORD"


class EmailCode(SQLModel, table=True):
    """A one-time code mailed to the user. Only its HMAC is stored; at most one live code per user and purpose."""

    __tablename__ = "email_codes"  # pyrefly: ignore[bad-override]

    id: str = Field(default_factory=_uuid, primary_key=True, max_length=36)
    user_id: str = Field(foreign_key="users.id", ondelete="CASCADE", index=True, max_length=36)
    purpose: str = Field(max_length=20)
    code_hash: str = Field(max_length=64)
    attempts: int = 0
    created_at: datetime = Field(sa_column=tstz(nullable=False))
    expires_at: datetime = Field(sa_column=tstz(nullable=False))
    consumed_at: datetime | None = Field(default=None, sa_column=tstz())
