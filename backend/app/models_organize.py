"""Organize tables: starred boards, own templates, focus sessions (Phase 24), workspaces (26)."""

from datetime import datetime

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

from app.models import utcnow


class Workspace(SQLModel, table=True):
    """A named group of the owner's related boards; private to the owner."""

    __tablename__ = "workspaces"

    id: int | None = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    name: str
    created_at: datetime = Field(default_factory=utcnow)


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
