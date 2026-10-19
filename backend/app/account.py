"""Account emails: build links from APP_URL and send them."""

from fastapi import Request
from sqlmodel import Session

from app import email_tokens
from app.mailer import reset_email, verification_email
from app.models import TokenPurpose, User


def _link(request: Request, path: str, token: str) -> str:
    return f"{request.app.state.settings.app_url}{path}?token={token}"


def send_verification(request: Request, session: Session, user: User) -> None:
    token = email_tokens.issue(session, user, TokenPurpose.verify)
    request.app.state.mailer.send(verification_email(user.email, _link(request, "/verify", token)))


def send_reset(request: Request, session: Session, user: User) -> None:
    token = email_tokens.issue(session, user, TokenPurpose.reset)
    link = _link(request, "/reset-password", token)
    request.app.state.mailer.send(reset_email(user.email, link))
