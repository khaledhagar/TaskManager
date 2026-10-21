"""Notifications, email setting, unsubscribe link and the reminder job endpoint (Phase 23)."""

import hmac
from datetime import UTC, date, datetime

from fastapi import APIRouter, Header, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import selectinload
from sqlmodel import func, select

from app.access import not_found
from app.auth import CurrentUser
from app.db import SessionDep
from app.i18n import tr
from app.jobs import send_reminders
from app.models import BoardMember
from app.models_notify import Notification, NotificationSetting
from app.notify import unsubscribe_user
from app.schemas import Strict

router = APIRouter(prefix="/api", tags=["notifications"])


class NotificationOut(BaseModel):
    id: int
    kind: str
    board_id: int
    card_id: int | None
    actor_email: str | None
    data: dict
    created_at: datetime
    read: bool


class NotificationsOut(BaseModel):
    unread: int
    items: list[NotificationOut]


class EmailSetting(Strict):
    email: bool


class TokenIn(Strict):
    token: str


def _mine(user):
    """The user's notifications on boards they still belong to (SEC-202)."""
    member = select(BoardMember.board_id).where(BoardMember.user_id == user.id)
    return select(Notification).where(
        Notification.user_id == user.id, Notification.board_id.in_(member)
    )


@router.get("/notifications")
def list_notifications(user: CurrentUser, session: SessionDep) -> NotificationsOut:
    unread = session.exec(
        select(func.count()).select_from(_mine(user).where(Notification.read_at == None).subquery())  # noqa: E711
    ).one()
    rows = session.exec(
        _mine(user)
        .options(selectinload(Notification.actor))
        .order_by(Notification.id.desc())
        .limit(30)
    )
    items = [
        NotificationOut(
            id=n.id,
            kind=n.kind,
            board_id=n.board_id,
            card_id=n.card_id,
            actor_email=n.actor.email if n.actor else None,
            data=n.data,
            created_at=n.created_at,
            read=n.read_at is not None,
        )
        for n in rows
    ]
    return NotificationsOut(unread=unread, items=items)


@router.post("/notifications/{notification_id}/read", status_code=204)
def read_one(notification_id: int, user: CurrentUser, session: SessionDep) -> None:
    note = session.exec(_mine(user).where(Notification.id == notification_id)).first()
    if note is None:
        raise not_found()
    note.read_at = note.read_at or datetime.now(UTC)
    session.commit()


@router.post("/notifications/read-all", status_code=204)
def read_all(user: CurrentUser, session: SessionDep) -> None:
    now = datetime.now(UTC)
    for note in session.exec(_mine(user).where(Notification.read_at == None)):  # noqa: E711
        note.read_at = now
    session.commit()


def _setting(session, user_id: int) -> NotificationSetting:
    return session.get(NotificationSetting, user_id) or NotificationSetting(user_id=user_id)


@router.get("/notifications/settings")
def get_settings(user: CurrentUser, session: SessionDep) -> EmailSetting:
    return EmailSetting(email=_setting(session, user.id).email)


@router.patch("/notifications/settings")
def set_settings(body: EmailSetting, user: CurrentUser, session: SessionDep) -> EmailSetting:
    setting = _setting(session, user.id)
    setting.email = body.email
    session.add(setting)
    session.commit()
    return EmailSetting(email=setting.email)


@router.post("/notifications/unsubscribe", status_code=204)
def unsubscribe(body: TokenIn, request: Request, session: SessionDep) -> None:
    """The link at the end of every email; works without signing in (SEC-203)."""
    user_id = unsubscribe_user(body.token, request.app.state.settings.jwt_secret)
    if user_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, tr("This link is invalid."))
    setting = _setting(session, user_id)
    setting.email = False
    session.add(setting)
    session.commit()


@router.post("/cron/reminders")
def cron_reminders(
    request: Request, session: SessionDep, authorization: str = Header(default="")
) -> dict:
    """Run by the scheduler with `Authorization: Bearer <CRON_SECRET>` (SEC-204)."""
    settings = request.app.state.settings
    if not settings.cron_secret:
        raise not_found()
    if not hmac.compare_digest(authorization, f"Bearer {settings.cron_secret}"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, tr("Not signed in"))
    return {"emails": send_reminders(session, request.app.state.mailer, settings, date.today())}
