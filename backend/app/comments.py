"""Mentions in comments: `@email` of a board member (Phase 22)."""

import re

from sqlmodel import Session, select

from app.models import BoardMember, User

MENTION = re.compile(r"@([^\s@]+@[^\s@]+\.[A-Za-z]{2,})")


def mentioned_members(session: Session, board_id: int, author_id: int, text: str) -> list[User]:
    """Members of the board named as @email in `text`, except the author (SEC-201)."""
    emails = {m.lower() for m in MENTION.findall(text)}
    if not emails:
        return []
    stmt = (
        select(User)
        .join(BoardMember, BoardMember.user_id == User.id)
        .where(BoardMember.board_id == board_id, User.email.in_(emails), User.id != author_id)
        .order_by(User.email)
    )
    return list(session.exec(stmt))
