"""Account flows: register + email OTP, login, refresh-token rotation with reuse detection, password reset.

Public endpoints answer the same way whether or not an email has an account (no enumeration); emails are sent
from background tasks so timing does not tell either.
"""

import re
import threading
import uuid
from collections.abc import Callable
from datetime import timedelta

from fastapi import HTTPException
from sqlmodel import Session, col, delete, select, update

from app.common import tokens
from app.core import clock
from app.core.config import get_settings
from app.core.errors import error
from app.core.ratelimit import IpRateLimiter
from app.modules.auth import mailer, security
from app.modules.auth.models import CodePurpose, EmailCode, RefreshToken, User
from app.modules.auth.schemas import TokenPair, UserOut

Schedule = Callable[..., None]  # BackgroundTasks.add_task

INVALID_LOGIN = "Incorrect email or password."
INVALID_CODE = "Invalid or expired code."
INVALID_REFRESH = "Invalid refresh token."

_limiter_lock = threading.Lock()
_login_limiter: IpRateLimiter | None = None


def _login_allowed(email: str) -> bool:
    global _login_limiter
    with _limiter_lock:
        if _login_limiter is None:
            s = get_settings()
            _login_limiter = IpRateLimiter(s.login_attempts_per_window, s.login_window_seconds, 100_000)
    return _login_limiter.allow(email)


def reset_login_limiter() -> None:
    global _login_limiter
    with _limiter_lock:
        _login_limiter = None


def user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        email_verified=user.email_verified_at is not None,
        created_at=user.created_at,
    )


def _by_email(session: Session, raw: str) -> tuple[str | None, User | None]:
    email = security.normalize_email(raw)
    if email is None:
        return None, None
    return email, session.exec(select(User).where(User.email == email)).first()


def _clean_name(name: str | None) -> str | None:
    name = re.sub(r"\s+", " ", name or "").strip()
    return name or None


# ---- one-time codes ---------------------------------------------------------------------------------------------
def _issue_code(session: Session, user: User, purpose: CodePurpose, schedule: Schedule) -> None:
    """Stores a fresh code and mails it, unless one was sent within the cooldown."""
    s, now = get_settings(), clock.now()
    latest = session.exec(
        select(EmailCode)
        .where(EmailCode.user_id == user.id, EmailCode.purpose == purpose)
        .order_by(col(EmailCode.created_at).desc())
    ).first()
    if latest is not None and now - latest.created_at < timedelta(seconds=s.otp_resend_cooldown_seconds):
        return
    session.exec(delete(EmailCode).where(col(EmailCode.user_id) == user.id, col(EmailCode.purpose) == purpose))
    code = security.new_code()
    session.add(
        EmailCode(
            user_id=user.id,
            purpose=purpose,
            code_hash=security.code_digest(user.id, purpose, code),
            created_at=now,
            expires_at=now + timedelta(seconds=s.otp_ttl_seconds),
        )
    )
    session.commit()
    schedule(mailer.send_code, user.email, purpose, code, s.otp_ttl_seconds // 60)


def _consume_code(session: Session, user: User | None, purpose: CodePurpose, code: str) -> User:
    if user is None:
        raise error(400, INVALID_CODE)
    now = clock.now()
    record = session.exec(
        select(EmailCode)
        .where(EmailCode.user_id == user.id, EmailCode.purpose == purpose)
        .where(col(EmailCode.consumed_at).is_(None))
        .with_for_update()
    ).first()
    if record is None or record.expires_at <= now or record.attempts >= get_settings().otp_max_attempts:
        raise error(400, INVALID_CODE)
    if not tokens.equal(record.code_hash, security.code_digest(user.id, purpose, code)):
        record.attempts += 1
        session.commit()
        raise error(400, INVALID_CODE)
    record.consumed_at = now
    return user


# ---- tokens -----------------------------------------------------------------------------------------------------
def _issue_tokens(session: Session, user: User, family_id: str | None = None) -> TokenPair:
    s, now = get_settings(), clock.now()
    refresh = tokens.issue()
    ttl = timedelta(days=s.refresh_token_ttl_days)
    session.add(
        RefreshToken(
            user_id=user.id,
            family_id=family_id or str(uuid.uuid4()),
            token_hash=tokens.hash_token(refresh),
            created_at=now,
            expires_at=now + ttl,
        )
    )
    session.commit()
    access, expires_in = security.create_access_token(user.id)
    return TokenPair(
        access_token=access,
        expires_in=expires_in,
        refresh_token=refresh,
        refresh_expires_in=int(ttl.total_seconds()),
    )


def _revoke(session: Session, *conditions) -> None:
    session.exec(
        update(RefreshToken).where(*conditions, col(RefreshToken.revoked_at).is_(None)).values(revoked_at=clock.now())
    )


def _usable(user: User | None) -> bool:
    return user is not None and user.is_active and user.email_verified_at is not None


# ---- flows ------------------------------------------------------------------------------------------------------
def register(session: Session, raw_email: str, password: str, name: str | None, schedule: Schedule) -> None:
    email, user = _by_email(session, raw_email)
    if email is None:
        raise error(400, "Invalid email address.")
    hashed = security.hash_password(password)  # always hash: same cost whether or not the account exists
    if user is not None and user.email_verified_at is not None:
        schedule(mailer.send_already_registered, user.email)
        return
    if user is None:
        user = User(email=email, password_hash=hashed, display_name=_clean_name(name), created_at=clock.now())
        session.add(user)
    else:  # unverified: the latest registration wins; only the mailbox owner can confirm it
        user.password_hash, user.display_name = hashed, _clean_name(name)
    session.commit()
    _issue_code(session, user, CodePurpose.VERIFY_EMAIL, schedule)


def resend_verification(session: Session, raw_email: str, schedule: Schedule) -> None:
    _, user = _by_email(session, raw_email)
    if user is not None and user.is_active and user.email_verified_at is None:
        _issue_code(session, user, CodePurpose.VERIFY_EMAIL, schedule)


def verify_email(session: Session, raw_email: str, code: str) -> TokenPair:
    _, found = _by_email(session, raw_email)
    user = _consume_code(session, found, CodePurpose.VERIFY_EMAIL, code)
    if not user.is_active:
        raise error(403, "This account is disabled.")
    user.email_verified_at = user.email_verified_at or clock.now()
    session.commit()
    return _issue_tokens(session, user)


def login(session: Session, raw_email: str, password: str) -> TokenPair:
    email, user = _by_email(session, raw_email)
    if email is not None and not _login_allowed(email):
        retry = str(int(get_settings().login_window_seconds))
        raise HTTPException(429, "Too many sign-in attempts. Please retry later.", {"Retry-After": retry})
    valid, rehashed = security.verify_password(password, user.password_hash if user else None)
    if user is None or not valid:
        raise error(401, INVALID_LOGIN)
    if rehashed is not None:
        user.password_hash = rehashed
        session.commit()
    if not user.is_active:
        raise error(403, "This account is disabled.")
    if user.email_verified_at is None:
        raise error(403, "Email address is not verified.")
    return _issue_tokens(session, user)


def refresh(session: Session, raw: str) -> TokenPair:
    if not re.fullmatch(r"[A-Za-z0-9_-]{43}", raw):
        raise error(401, INVALID_REFRESH)
    now = clock.now()
    row = session.exec(
        select(RefreshToken).where(RefreshToken.token_hash == tokens.hash_token(raw)).with_for_update()
    ).first()
    if row is None or row.revoked_at is not None or row.expires_at <= now:
        raise error(401, INVALID_REFRESH)
    if row.used_at is not None:
        grace = timedelta(seconds=get_settings().refresh_reuse_grace_seconds)
        if now - row.used_at > grace:  # an old token came back: assume theft and end the whole session
            _revoke(session, col(RefreshToken.family_id) == row.family_id)
            session.commit()
            raise error(401, INVALID_REFRESH)
    else:
        row.used_at = now
    user = session.get(User, row.user_id)
    if user is None or not _usable(user):
        _revoke(session, col(RefreshToken.family_id) == row.family_id)
        session.commit()
        raise error(401, INVALID_REFRESH)
    return _issue_tokens(session, user, row.family_id)


def logout(session: Session, raw: str) -> None:
    row = session.exec(select(RefreshToken).where(RefreshToken.token_hash == tokens.hash_token(raw))).first()
    if row is not None:
        _revoke(session, col(RefreshToken.family_id) == row.family_id)
        session.commit()


def logout_all(session: Session, user: User) -> None:
    _revoke(session, col(RefreshToken.user_id) == user.id)
    session.commit()


def forgot_password(session: Session, raw_email: str, schedule: Schedule) -> None:
    _, user = _by_email(session, raw_email)
    if user is not None and user.is_active:
        _issue_code(session, user, CodePurpose.RESET_PASSWORD, schedule)


def reset_password(session: Session, raw_email: str, code: str, new_password: str) -> None:
    _, found = _by_email(session, raw_email)
    user = _consume_code(session, found, CodePurpose.RESET_PASSWORD, code)
    user.password_hash = security.hash_password(new_password)
    user.email_verified_at = user.email_verified_at or clock.now()  # the code proved mailbox ownership
    _revoke(session, col(RefreshToken.user_id) == user.id)
    session.commit()


def change_password(session: Session, user: User, current: str, new_password: str) -> TokenPair:
    valid, _ = security.verify_password(current, user.password_hash)
    if not valid:
        raise error(400, "Current password is incorrect.")
    user.password_hash = security.hash_password(new_password)
    _revoke(session, col(RefreshToken.user_id) == user.id)  # sign out every other device
    session.commit()
    return _issue_tokens(session, user)


def update_profile(session: Session, user: User, name: str | None) -> UserOut:
    user.display_name = _clean_name(name)
    session.commit()
    return user_out(user)


def purge(session: Session) -> None:
    """Drops expired refresh tokens and codes."""
    now = clock.now()
    session.exec(delete(RefreshToken).where(col(RefreshToken.expires_at) <= now))
    session.exec(delete(EmailCode).where(col(EmailCode.expires_at) <= now))
    session.commit()
