"""Email verification and password routes."""

from contextlib import suppress

from fastapi import APIRouter, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field

from app import email_tokens, ratelimit
from app.account import send_reset, send_verification
from app.auth import CurrentUser, Password, UserOut, start_session
from app.db import SessionDep
from app.i18n import tr
from app.mailer import MailError
from app.models import TokenPurpose, User
from app.passwords import require_not_weak
from app.schemas import Strict
from app.security import hash_password, verify_password
from app.users import find_by_email

router = APIRouter(prefix="/api/auth", tags=["account"])

INVALID_LINK = "This link is invalid or has expired. Please request a new one."
RESEND_ANSWER = "If an account needs verification, we sent a new link."
RESET_ANSWER = "If an account exists for this email, we sent a reset link."

Token = Field(min_length=10, max_length=200)


class TokenIn(Strict):
    token: str = Token


class EmailIn(Strict):
    email: EmailStr


class ResetIn(Strict):
    token: str = Token
    password: Password


class ChangeIn(Strict):
    current_password: str | None = Field(default=None, max_length=128)
    new_password: Password


class Answer(BaseModel):
    detail: str


def _limit_emails(request: Request, email: str) -> None:
    """Emails we send on request: limited per address and per IP (SEC-121)."""
    ratelimit.enforce(request, f"email-ip:{ratelimit.client_ip(request)}", ratelimit.EMAIL_PER_IP)
    ratelimit.enforce(request, f"email:{email.lower()}", ratelimit.EMAIL_PER_ADDRESS)


def _consume(session: SessionDep, token: str, purpose: TokenPurpose) -> User:
    user = email_tokens.consume(session, token, purpose)
    if user is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, tr(INVALID_LINK))
    return user


def _mark_verified(user: User) -> None:
    user.email_verified = True
    user.is_guest = False


@router.post("/verify")
def verify(body: TokenIn, request: Request, response: Response, session: SessionDep) -> UserOut:
    user = _consume(session, body.token, TokenPurpose.verify)
    _mark_verified(user)
    session.commit()
    return start_session(request, response, user)


@router.post("/resend-verification", status_code=202)
def resend_verification(body: EmailIn, request: Request, session: SessionDep) -> Answer:
    _limit_emails(request, body.email)
    user = find_by_email(session, body.email.lower())
    if user and not user.email_verified and user.password_hash:
        # The answer stays the same either way, so it never reveals which addresses exist.
        with suppress(MailError):
            send_verification(request, session, user)
    return Answer(detail=tr(RESEND_ANSWER))


@router.post("/forgot-password", status_code=202)
def forgot_password(body: EmailIn, request: Request, session: SessionDep) -> Answer:
    _limit_emails(request, body.email)
    user = find_by_email(session, body.email.lower())
    if user:
        with suppress(MailError):
            send_reset(request, session, user)
    return Answer(detail=tr(RESET_ANSWER))


@router.post("/reset-password")
def reset_password(
    body: ResetIn, request: Request, response: Response, session: SessionDep
) -> UserOut:
    """Set a new password; the link proves email ownership, and other sessions end."""
    owner = email_tokens.owner(session, body.token, TokenPurpose.reset)
    if owner:
        require_not_weak(body.password, owner.email)
    user = _consume(session, body.token, TokenPurpose.reset)
    user.password_hash = hash_password(body.password)
    user.token_version += 1
    _mark_verified(user)
    session.commit()
    return start_session(request, response, user)


@router.post("/change-password")
def change_password(
    body: ChangeIn, request: Request, response: Response, user: CurrentUser, session: SessionDep
) -> UserOut:
    """Change (or, for Google-only accounts, set) the password; other sessions end."""
    if user.password_hash and not verify_password(body.current_password or "", user.password_hash):
        raise HTTPException(status.HTTP_403_FORBIDDEN, tr("Current password is incorrect"))
    require_not_weak(body.new_password, user.email)
    user.password_hash = hash_password(body.new_password)
    user.token_version += 1
    session.commit()
    return start_session(request, response, user)
