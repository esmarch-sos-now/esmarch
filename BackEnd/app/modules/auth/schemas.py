from datetime import datetime

from pydantic import BaseModel, Field

from app.common.schemas import CamelModel

Password = Field(min_length=8, max_length=128)
Code = Field(pattern=r"^\d{6}$")
FirebaseToken = Field(min_length=20, max_length=4096)  # Firebase ID token (JWT) from the browser's SMS sign-in


class TokenPair(BaseModel):
    """OAuth2 token response (RFC 6749 §5.1), so snake_case like the spec. Only the Next server ever sees it."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_token: str
    refresh_expires_in: int


class Register(CamelModel):
    email: str = Field(max_length=254)
    password: str = Password
    display_name: str | None = Field(default=None, max_length=100)


class EmailOnly(CamelModel):
    email: str = Field(max_length=254)


class VerifyEmail(CamelModel):
    email: str = Field(max_length=254)
    code: str = Code


class ResetPassword(CamelModel):
    email: str = Field(max_length=254)
    code: str = Code
    new_password: str = Password


class ChangePassword(CamelModel):
    current_password: str = Field(max_length=128)
    new_password: str = Password


class RefreshRequest(CamelModel):
    refresh_token: str = Field(max_length=64)


class UpdateProfile(CamelModel):
    display_name: str | None = Field(default=None, max_length=100)


class Accepted(CamelModel):
    status: str = "accepted"


class PhoneRegister(CamelModel):
    id_token: str = FirebaseToken
    password: str = Password
    display_name: str | None = Field(default=None, max_length=100)


class PhoneReset(CamelModel):
    id_token: str = FirebaseToken
    new_password: str = Password


class UserOut(CamelModel):
    id: str
    email: str | None
    phone: str | None
    display_name: str | None
    email_verified: bool
    phone_verified: bool
    created_at: datetime
