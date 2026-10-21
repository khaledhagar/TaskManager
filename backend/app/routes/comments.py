"""Comments on cards and the board activity log (Phase 22)."""

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import selectinload
from sqlmodel import select

from app.access import RANK, board_role, card_for, not_found
from app.activity import record
from app.auth import CurrentUser
from app.db import SessionDep
from app.i18n import tr
from app.models import Activity, Comment, Role
from app.schemas import Strict, text

router = APIRouter(prefix="/api", tags=["comments"])


class CommentIn(Strict):
    text: text(5000)


class CommentOut(BaseModel):
    id: int
    card_id: int
    author_id: int
    author_email: str | None
    text: str
    created_at: datetime
    edited_at: datetime | None


class ActivityOut(BaseModel):
    id: int
    kind: str
    data: dict
    card_id: int | None
    actor_email: str | None
    created_at: datetime


def comment_out(comment: Comment) -> CommentOut:
    return CommentOut(
        id=comment.id,
        card_id=comment.card_id,
        author_id=comment.author_id,
        author_email=comment.author.email,
        text=comment.text,
        created_at=comment.created_at,
        edited_at=comment.edited_at,
    )


@router.get("/cards/{card_id}/comments")
def list_comments(card_id: int, user: CurrentUser, session: SessionDep) -> list[CommentOut]:
    card_for(session, user, card_id, Role.viewer)
    stmt = (
        select(Comment)
        .where(Comment.card_id == card_id)
        .options(selectinload(Comment.author))
        .order_by(Comment.id)
    )
    return [comment_out(c) for c in session.exec(stmt)]


@router.post("/cards/{card_id}/comments", status_code=201)
def add_comment(
    card_id: int, body: CommentIn, user: CurrentUser, session: SessionDep
) -> CommentOut:
    """Viewers read; "Can update tasks" and above write (SEC-200)."""
    card = card_for(session, user, card_id, Role.updater)
    comment = Comment(card_id=card.id, author_id=user.id, text=body.text)
    session.add(comment)
    record(session, card.column.board_id, user, "comment.added", card)
    session.commit()
    return comment_out(comment)


def _comment(session, user, comment_id: int, need: Role) -> Comment:
    comment = session.get(Comment, comment_id)
    if comment is None:
        raise not_found()
    card_for(session, user, comment.card_id, need)
    return comment


@router.patch("/comments/{comment_id}")
def edit_comment(
    comment_id: int, body: CommentIn, user: CurrentUser, session: SessionDep
) -> CommentOut:
    comment = _comment(session, user, comment_id, Role.updater)
    if comment.author_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, tr("You can only change your own comments."))
    comment.text = body.text
    comment.edited_at = datetime.now(UTC)
    card = comment.card
    record(session, card.column.board_id, user, "comment.edited", card)
    session.commit()
    return comment_out(comment)


@router.delete("/comments/{comment_id}", status_code=204)
def delete_comment(comment_id: int, user: CurrentUser, session: SessionDep) -> None:
    """The author (who can still comment) or the board admin."""
    comment = _comment(session, user, comment_id, Role.viewer)
    card = comment.card
    role = board_role(session, user, card.column.board_id)
    author = comment.author_id == user.id and RANK[role] >= RANK[Role.updater]
    if not author and role != Role.admin:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            tr("Only the author or the board admin can delete this comment."),
        )
    record(session, card.column.board_id, user, "comment.deleted", card)
    session.delete(comment)
    session.commit()


@router.get("/boards/{board_id}/activity")
def list_activity(
    board_id: int,
    user: CurrentUser,
    session: SessionDep,
    card_id: int | None = None,
    before: int | None = None,
    limit: int = Query(50, ge=1, le=100),
) -> list[ActivityOut]:
    """Newest first; `before` pages to older entries; `card_id` gives one card's history."""
    board_role(session, user, board_id)
    stmt = (
        select(Activity).where(Activity.board_id == board_id).options(selectinload(Activity.actor))
    )
    if card_id is not None:
        stmt = stmt.where(Activity.card_id == card_id)
    if before is not None:
        stmt = stmt.where(Activity.id < before)
    rows = session.exec(stmt.order_by(Activity.id.desc()).limit(limit))
    return [
        ActivityOut(
            id=a.id,
            kind=a.kind,
            data=a.data,
            card_id=a.card_id,
            actor_email=a.actor.email if a.actor else None,
            created_at=a.created_at,
        )
        for a in rows
    ]
