"""Board sharing: admin rows, invite tokens and member counts (SEC-162 to SEC-169)."""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from sqlmodel import Session, func, select

from app.models import Board, BoardInvite, BoardMember, Role, User

INVITE_TTL = timedelta(days=7)


def backfill_admins(session: Session) -> None:
    """Give every board's owner an admin row (boards made before sharing existed)."""
    has_admin = select(BoardMember.id).where(
        BoardMember.board_id == Board.id, BoardMember.user_id == Board.owner_id
    )
    for board in session.exec(select(Board).where(~has_admin.exists())):
        session.add(BoardMember(board_id=board.id, user_id=board.owner_id, role=Role.admin))
    session.commit()


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def new_invite_token(invite: BoardInvite) -> str:
    """Give the invite a fresh token and expiry; return the raw token (never stored)."""
    raw = secrets.token_urlsafe(32)
    invite.token_hash = _hash(raw)
    invite.expires_at = datetime.now(UTC) + INVITE_TTL
    return raw


def valid_invite(session: Session, raw: str) -> BoardInvite | None:
    """The unused, unexpired invite for this token."""
    invite = session.exec(select(BoardInvite).where(BoardInvite.token_hash == _hash(raw))).first()
    if invite is None or invite.used_at is not None:
        return None
    if invite.expires_at.replace(tzinfo=UTC) < datetime.now(UTC):
        return None
    return invite


def pending_invites(session: Session, board_id: int) -> list[BoardInvite]:
    now = datetime.now(UTC)
    stmt = (
        select(BoardInvite)
        .where(BoardInvite.board_id == board_id, BoardInvite.used_at == None)  # noqa: E711
        .order_by(BoardInvite.id)
    )
    return [i for i in session.exec(stmt) if i.expires_at.replace(tzinfo=UTC) >= now]


def member_count(session: Session, board_id: int) -> int:
    stmt = select(func.count()).select_from(BoardMember).where(BoardMember.board_id == board_id)
    return session.exec(stmt).one()


def membership(session: Session, board_id: int, user_id: int) -> BoardMember | None:
    stmt = select(BoardMember).where(
        BoardMember.board_id == board_id, BoardMember.user_id == user_id
    )
    return session.exec(stmt).first()


def is_member_email(session: Session, board_id: int, email: str) -> bool:
    stmt = (
        select(BoardMember.id)
        .join(User)
        .where(BoardMember.board_id == board_id, User.email == email)
    )
    return session.exec(stmt).first() is not None


def invite_link(app_url: str, raw: str) -> str:
    """The token goes after '#', so it never reaches server logs or Referer headers."""
    return f"{app_url}/invite#token={raw}"


def board_link(app_url: str, board_id: int) -> str:
    return f"{app_url}/?board={board_id}&members=1"
