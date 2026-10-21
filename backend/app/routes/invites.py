"""Board invitations: create, resend, cancel, preview and accept (Phase 18)."""

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, EmailStr

from app import limits, ratelimit
from app.access import board_for, not_found
from app.activity import record
from app.auth import CurrentUser
from app.db import SessionDep
from app.i18n import tr
from app.mailer import invite_email
from app.models import Board, BoardInvite, BoardMember, Role, User
from app.schemas import BoardSummary, Strict, board_summary
from app.sharing import (
    invite_link,
    is_member_email,
    member_count,
    membership,
    new_invite_token,
    pending_invites,
    valid_invite,
)
from app.watch import drop_invited, invitation_used, invited

router = APIRouter(prefix="/api", tags=["invites"])

INVALID = "This invitation link is invalid or has expired."
MEMBER_LIMIT = "Limit reached: at most {cap} members per board"


class InviteIn(Strict):
    email: EmailStr


class TokenIn(Strict):
    token: str


class InviteCreated(BaseModel):
    id: int
    email: str
    expires_at: datetime
    link: str


class InvitePreview(BaseModel):
    board_title: str
    invited_by: str | None
    email: str


def _send(request: Request, session, invite: BoardInvite, inviter: User) -> InviteCreated:
    """Give the invite a fresh link, email it, and return it for Copy and WhatsApp."""
    raw = new_invite_token(invite)
    session.add(invite)
    record(session, invite.board_id, inviter, "invite.sent", email=invite.email)
    board = session.get(Board, invite.board_id)
    invited(session, invite, inviter, board, f"/invite#token={raw}")
    session.commit()
    link = invite_link(request.app.state.settings.app_url, raw)
    request.app.state.mailer.send(invite_email(invite.email, inviter.email, board.title, link))
    return InviteCreated(id=invite.id, email=invite.email, expires_at=invite.expires_at, link=link)


@router.post("/boards/{board_id}/invites", status_code=201)
def create_invite(
    board_id: int, body: InviteIn, request: Request, user: CurrentUser, session: SessionDep
) -> InviteCreated:
    board_for(session, user, board_id, Role.admin)
    if user.is_guest:
        raise HTTPException(status.HTTP_403_FORBIDDEN, tr("Create an account to share this board."))
    ratelimit.enforce(request, f"invite:{user.id}", ratelimit.INVITES)
    email = body.email.lower()
    if is_member_email(session, board_id, email):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, tr("This person is already a member of this board.")
        )
    pending = pending_invites(session, board_id)
    invite = next((i for i in pending if i.email == email), None)
    if invite is None:
        limits.check(
            len(pending),
            limits.INVITES_PER_BOARD,
            "Limit reached: at most {cap} pending invitations per board",
        )
        limits.check(member_count(session, board_id), limits.MEMBERS_PER_BOARD, MEMBER_LIMIT)
        invite = BoardInvite(board_id=board_id, invited_by=user.id, email=email)
    return _send(request, session, invite, user)


def _admin_invite(session, user: User, invite_id: int) -> BoardInvite:
    invite = session.get(BoardInvite, invite_id)
    if invite is None or invite.used_at is not None:
        raise not_found()
    board_for(session, user, invite.board_id, Role.admin)
    return invite


@router.post("/invites/{invite_id}/resend")
def resend_invite(
    invite_id: int, request: Request, user: CurrentUser, session: SessionDep
) -> InviteCreated:
    """A new link replaces the old one, which stops working."""
    invite = _admin_invite(session, user, invite_id)
    ratelimit.enforce(request, f"invite:{user.id}", ratelimit.INVITES)
    return _send(request, session, invite, user)


@router.delete("/invites/{invite_id}", status_code=204)
def cancel_invite(invite_id: int, user: CurrentUser, session: SessionDep) -> None:
    invite = _admin_invite(session, user, invite_id)
    drop_invited(session, invite)
    session.delete(invite)
    session.commit()


def _valid(session, token: str) -> BoardInvite:
    invite = valid_invite(session, token)
    if invite is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, tr(INVALID))
    return invite


@router.post("/invites/preview")
def preview_invite(body: TokenIn, session: SessionDep) -> InvitePreview:
    """Open without sign-in: shows the board, the inviter and the invited email."""
    invite = _valid(session, body.token)
    board = session.get(Board, invite.board_id)
    inviter = session.get(User, invite.invited_by)
    return InvitePreview(board_title=board.title, invited_by=inviter.email, email=invite.email)


@router.post("/invites/accept")
def accept_invite(body: TokenIn, user: CurrentUser, session: SessionDep) -> BoardSummary:
    invite = _valid(session, body.token)
    if user.is_guest or not user.email_verified:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            tr(
                "Create an account or sign in with {email} to accept this invitation.",
                email=invite.email,
            ),
        )
    if user.email != invite.email:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            tr(
                "This invitation was sent to {email}. Sign in with that address to accept it.",
                email=invite.email,
            ),
        )
    member = membership(session, invite.board_id, user.id)
    if member is None:
        limits.check(member_count(session, invite.board_id), limits.MEMBERS_PER_BOARD, MEMBER_LIMIT)
        member = BoardMember(board_id=invite.board_id, user_id=user.id, role=Role.viewer)
        session.add(member)
        record(session, invite.board_id, user, "member.joined", email=user.email)
    invite.used_at = datetime.now(UTC)
    invitation_used(session, invite.board_id, user)
    session.commit()
    return board_summary(session.get(Board, invite.board_id), member.role)
