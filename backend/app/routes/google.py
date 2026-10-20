"""Google sign-in routes: login redirect, callback, and provider config."""

import logging

from authlib.integrations.base_client import OAuthError
from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlmodel import Session

from app import google
from app.auth import OptionalUser, start_session
from app.db import SessionDep
from app.i18n import tr
from app.models import User
from app.users import create_user, find_by_email, find_by_google_id

router = APIRouter(prefix="/api/auth", tags=["google"])
log = logging.getLogger("taskmanager.google")


class GoogleRejected(Exception):
    """The Google identity cannot be used for this account."""


@router.get("/config")
def auth_config(request: Request) -> dict:
    return {"google": request.app.state.settings.google_enabled}


@router.get("/google/login")
async def google_login(request: Request):
    if not request.app.state.settings.google_enabled:
        raise HTTPException(status.HTTP_404_NOT_FOUND, tr("Google sign-in is not configured"))
    return await google.login_redirect(request)


@router.get("/google/callback")
async def google_callback(request: Request, session: SessionDep, current: OptionalUser):
    app_url = request.app.state.settings.app_url
    try:
        identity = await google.fetch_identity(request)
        user = resolve_user(session, identity, current)
    except (OAuthError, GoogleRejected) as exc:
        log.info("Google sign-in rejected: %s", type(exc).__name__)
        return RedirectResponse(f"{app_url}/signin?error=google", status.HTTP_302_FOUND)
    response = RedirectResponse(f"{app_url}/", status.HTTP_302_FOUND)
    start_session(request, response, user)
    return response


def resolve_user(session: Session, identity: google.Identity, current: User | None) -> User:
    """Find, link or create the user for a verified Google identity."""
    if not identity.email_verified:
        raise GoogleRejected("email not verified")
    user = find_by_google_id(session, identity.sub)
    if user:
        return user
    by_email = find_by_email(session, identity.email)
    if current and current.is_guest:
        if by_email and by_email.id != current.id:
            raise GoogleRejected("email belongs to another account")
        return _link(session, current, identity)
    if by_email:
        if by_email.google_id:
            raise GoogleRejected("email linked to another Google account")
        return _link(session, by_email, identity)
    return create_user(session, identity.email, None, verified=True, google_id=identity.sub)


def _link(session: Session, user: User, identity: google.Identity) -> User:
    user.google_id = identity.sub
    user.email = identity.email
    user.email_verified = True
    user.is_guest = False
    session.commit()
    return user
