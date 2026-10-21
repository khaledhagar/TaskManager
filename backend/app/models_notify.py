"""Notification tables (Phase 23)."""

from datetime import date, datetime

from sqlalchemy import JSON, Column
from sqlmodel import Field, Relationship, SQLModel

from app.models import User, utcnow


class Notification(SQLModel, table=True):
    """Something for one user: assigned, mentioned, a card due tomorrow or overdue."""

    __tablename__ = "notifications"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    kind: str
    board_id: int = Field(foreign_key="boards.id", ondelete="CASCADE", index=True)
    card_id: int | None = Field(default=None, foreign_key="cards.id", ondelete="CASCADE")
    actor_id: int | None = Field(default=None, foreign_key="users.id", ondelete="SET NULL")
    data: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(default_factory=utcnow)
    read_at: datetime | None = None

    actor: User | None = Relationship(
        sa_relationship_kwargs={"foreign_keys": "Notification.actor_id"}
    )


class NotificationSetting(SQLModel, table=True):
    """Per user: emails on or off, and the day the last reminder email went out."""

    __tablename__ = "notification_settings"

    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", primary_key=True)
    email: bool = True
    last_reminder_on: date | None = None
