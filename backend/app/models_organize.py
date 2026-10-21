"""Organize tables (Phase 24): starred boards, own templates, focus sessions on cards."""

from datetime import datetime

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

from app.models import utcnow


class BoardStar(SQLModel, table=True):
    __tablename__ = "board_stars"

    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", primary_key=True)
    board_id: int = Field(foreign_key="boards.id", ondelete="CASCADE", primary_key=True)


class UserTemplate(SQLModel, table=True):
    """A board saved as a private template: columns, cards, labels and checklists."""

    __tablename__ = "user_templates"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    name: str
    data: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(default_factory=utcnow)


class FocusSession(SQLModel, table=True):
    """A finished focus period spent on a card."""

    __tablename__ = "focus_sessions"

    id: int | None = Field(default=None, primary_key=True)
    card_id: int = Field(foreign_key="cards.id", ondelete="CASCADE", index=True)
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    minutes: int
    ended_at: datetime = Field(default_factory=utcnow)
