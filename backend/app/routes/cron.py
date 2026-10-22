"""Scheduled jobs (SEC-204): Vercel Cron calls them daily with GET and the CRON_SECRET header."""

import hmac
from datetime import date
from time import time

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status

from app.access import not_found
from app.db import SessionDep
from app.i18n import tr
from app.jobs import heartbeat, send_reminders
from app.ratelimit import drop_expired
from app.users import cleanup_guests


def check_secret(request: Request, authorization: str = Header(default="")) -> None:
    """404 while no secret is configured; 401 unless the header carries it."""
    secret = request.app.state.settings.cron_secret
    if not secret:
        raise not_found()
    if not hmac.compare_digest(authorization, f"Bearer {secret}"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, tr("Not signed in"))


router = APIRouter(prefix="/api/cron", tags=["cron"], dependencies=[Depends(check_secret)])


@router.get("/reminders")
def reminders(request: Request, session: SessionDep) -> dict:
    """Email due-soon and overdue reminders."""
    state = request.app.state
    return {"emails": send_reminders(session, state.mailer, state.settings, date.today())}


@router.get("/cleanup")
def cleanup(session: SessionDep) -> dict:
    """Remove old guests and ended rate-limit counters, then record the heartbeat."""
    guests = cleanup_guests(session)
    counters = drop_expired(session, now=time())
    return {"guests": guests, "counters": counters, "heartbeat": heartbeat(session).isoformat()}
