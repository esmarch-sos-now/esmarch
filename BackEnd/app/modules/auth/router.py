"""Account endpoints. Token-issuing routes are meant for the Next.js server only; the browser never sees tokens."""

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Response
from fastapi.security import OAuth2PasswordRequestForm

from app.modules.auth import service
from app.modules.auth.deps import CurrentUser, Db, require_auth_configured
from app.modules.auth.schemas import (
    Accepted,
    ChangePassword,
    EmailOnly,
    RefreshRequest,
    Register,
    ResetPassword,
    TokenPair,
    UpdateProfile,
    UserOut,
    VerifyEmail,
)

router = APIRouter(prefix="/api/auth", tags=["auth"], dependencies=[Depends(require_auth_configured)])


@router.post("/register", status_code=202)
def register(body: Register, session: Db, background: BackgroundTasks) -> Accepted:
    """Creates (or refreshes) an unverified account and mails a 6-digit code. Same answer for existing emails."""
    service.register(session, body.email, body.password, body.display_name, background.add_task)
    return Accepted()


@router.post("/verify-email")
def verify_email(body: VerifyEmail, session: Db) -> TokenPair:
    """Confirms the email with the mailed code and signs the user in."""
    return service.verify_email(session, body.email, body.code)


@router.post("/resend-verification", status_code=202)
def resend_verification(body: EmailOnly, session: Db, background: BackgroundTasks) -> Accepted:
    service.resend_verification(session, body.email, background.add_task)
    return Accepted()


@router.post("/token")
def login(form: Annotated[OAuth2PasswordRequestForm, Depends()], session: Db) -> TokenPair:
    """OAuth2 password grant: `username` is the email."""
    return service.login(session, form.username, form.password)


@router.post("/refresh")
def refresh(body: RefreshRequest, session: Db) -> TokenPair:
    """Rotates the refresh token. Reusing an already-rotated one revokes the whole session."""
    return service.refresh(session, body.refresh_token)


@router.post("/logout", status_code=204)
def logout(body: RefreshRequest, session: Db) -> Response:
    service.logout(session, body.refresh_token)
    return Response(status_code=204)


@router.post("/logout-all", status_code=204)
def logout_all(user: CurrentUser, session: Db) -> Response:
    service.logout_all(session, user)
    return Response(status_code=204)


@router.post("/password/forgot", status_code=202)
def forgot_password(body: EmailOnly, session: Db, background: BackgroundTasks) -> Accepted:
    service.forgot_password(session, body.email, background.add_task)
    return Accepted()


@router.post("/password/reset", status_code=204)
def reset_password(body: ResetPassword, session: Db) -> Response:
    """Sets a new password with the mailed code and signs out every session."""
    service.reset_password(session, body.email, body.code, body.new_password)
    return Response(status_code=204)


@router.post("/password/change")
def change_password(body: ChangePassword, user: CurrentUser, session: Db) -> TokenPair:
    """Changes the password, signs out other sessions and returns a new pair for this one."""
    return service.change_password(session, user, body.current_password, body.new_password)


@router.get("/me")
def me(user: CurrentUser) -> UserOut:
    return service.user_out(user)


@router.patch("/me")
def update_me(body: UpdateProfile, user: CurrentUser, session: Db) -> UserOut:
    return service.update_profile(session, user, body.display_name)
