"""The board's meeting link: the admin sets it and sends it to every member (Phase 20).

Sending emails the link and leaves each member a notification that opens the board.
"""

from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, field_validator

from app import ratelimit
from app.access import board_for
from app.activity import record
from app.auth import CurrentUser
from app.db import SessionDep
from app.i18n import tr
from app.mailer import meeting_email
from app.models import MeetingLink, Notification, Role
from app.schemas import Strict

router = APIRouter(prefix="/api", tags=["meeting"])


class MeetingIn(Strict):
    url: str | None

    @field_validator("url")
    @classmethod
    def https_only(cls, url: str | None) -> str | None:
        """Only https links with a host (no javascript:, no http:) and at most 500 characters."""
        if not url:
            return None
        url = url.strip()
        parts = urlparse(url)
        if len(url) > 500 or parts.scheme != "https" or not parts.netloc:
            raise ValueError("Use an https link of at most 500 characters")
        return url


class MeetingOut(BaseModel):
    url: str | None


class Sent(BaseModel):
    sent: int


@router.put("/boards/{board_id}/meeting")
def set_meeting(
    board_id: int, body: MeetingIn, user: CurrentUser, session: SessionDep
) -> MeetingOut:
    board = board_for(session, user, board_id, Role.admin)
    if board.meeting_link:
        session.delete(board.meeting_link)
        session.flush()
    if body.url:
        session.add(MeetingLink(board_id=board_id, url=body.url))
    record(session, board_id, user, "meeting.set" if body.url else "meeting.removed")
    session.commit()
    return MeetingOut(url=body.url)


@router.post("/boards/{board_id}/meeting/email")
def email_meeting(board_id: int, request: Request, user: CurrentUser, session: SessionDep) -> Sent:
    """Email the meeting link to every member except the admin, and notify each of them."""
    board = board_for(session, user, board_id, Role.admin)
    if not board.meeting_link:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, tr("Add a meeting link first."))
    ratelimit.enforce(request, f"meeting:{board_id}", ratelimit.MEETING_EMAILS)
    others = [m.user for m in board.members if m.user_id != user.id and m.user.email]
    for person in others:
        request.app.state.mailer.send(
            meeting_email(person.email, user.email or "", board.title, board.meeting_link.url)
        )
        session.add(
            Notification(
                user_id=person.id,
                kind="meeting",
                board_id=board.id,
                actor_id=user.id,
                data={"board": board.title},
            )
        )
    session.commit()
    return Sent(sent=len(others))
