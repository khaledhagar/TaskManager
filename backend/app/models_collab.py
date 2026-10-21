"""Collaboration tables: comments on cards and the board activity log (Phase 22)."""

from datetime import datetime

from sqlalchemy import JSON, Column
from sqlmodel import Field, Relationship, SQLModel

from app.models import Card, User, utcnow


class Comment(SQLModel, table=True):
    """A comment on a card (Markdown, at most 5,000 characters)."""

    __tablename__ = "comments"

    id: int | None = Field(default=None, primary_key=True)
    card_id: int = Field(foreign_key="cards.id", ondelete="CASCADE", index=True)
    author_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    text: str
    created_at: datetime = Field(default_factory=utcnow)
    edited_at: datetime | None = None

    author: User = Relationship()
    card: Card = Relationship()


class Activity(SQLModel, table=True):
    """One change on a board: who, what kind, and short details (titles only, no descriptions)."""

    __tablename__ = "activity"

    id: int | None = Field(default=None, primary_key=True)
    board_id: int = Field(foreign_key="boards.id", ondelete="CASCADE", index=True)
    card_id: int | None = Field(
        default=None, foreign_key="cards.id", ondelete="SET NULL", index=True
    )
    actor_id: int | None = Field(default=None, foreign_key="users.id", ondelete="SET NULL")
    kind: str
    data: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(default_factory=utcnow)

    actor: User | None = Relationship()
