"""Database tables: users, boards, columns, cards, checklist items and labels."""

from datetime import UTC, date, datetime
from enum import StrEnum

from sqlmodel import Field, Relationship, SQLModel


def utcnow() -> datetime:
    return datetime.now(UTC)


class Priority(StrEnum):
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"


class LabelColor(StrEnum):
    red = "red"
    orange = "orange"
    yellow = "yellow"
    green = "green"
    blue = "blue"
    purple = "purple"
    gray = "gray"


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: int | None = Field(default=None, primary_key=True)
    email: str | None = Field(default=None, unique=True, index=True)
    password_hash: str | None = None
    is_guest: bool = False
    email_verified: bool = False
    google_id: str | None = Field(default=None, unique=True, index=True)
    token_version: int = 0
    created_at: datetime = Field(default_factory=utcnow)

    boards: list["Board"] = Relationship(back_populates="owner", cascade_delete=True)
    email_tokens: list["EmailToken"] = Relationship(cascade_delete=True)


class TokenPurpose(StrEnum):
    verify = "verify"
    reset = "reset"


class EmailToken(SQLModel, table=True):
    """Single-use emailed link token; only its SHA-256 hash is stored."""

    __tablename__ = "email_tokens"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    purpose: TokenPurpose
    token_hash: str = Field(unique=True, index=True)
    expires_at: datetime
    used_at: datetime | None = None


class Board(SQLModel, table=True):
    __tablename__ = "boards"

    id: int | None = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    title: str
    created_at: datetime = Field(default_factory=utcnow)

    owner: User = Relationship(back_populates="boards")
    columns: list["BoardColumn"] = Relationship(
        back_populates="board",
        cascade_delete=True,
        sa_relationship_kwargs={"order_by": "BoardColumn.position"},
    )
    labels: list["Label"] = Relationship(back_populates="board", cascade_delete=True)


class BoardColumn(SQLModel, table=True):
    __tablename__ = "columns"

    id: int | None = Field(default=None, primary_key=True)
    board_id: int = Field(foreign_key="boards.id", ondelete="CASCADE", index=True)
    title: str
    position: int

    board: Board = Relationship(back_populates="columns")
    cards: list["Card"] = Relationship(
        back_populates="column",
        cascade_delete=True,
        sa_relationship_kwargs={"order_by": "Card.position"},
    )


class CardLabel(SQLModel, table=True):
    __tablename__ = "card_labels"

    card_id: int = Field(foreign_key="cards.id", ondelete="CASCADE", primary_key=True)
    label_id: int = Field(foreign_key="labels.id", ondelete="CASCADE", primary_key=True)


class Card(SQLModel, table=True):
    __tablename__ = "cards"

    id: int | None = Field(default=None, primary_key=True)
    column_id: int = Field(foreign_key="columns.id", ondelete="CASCADE", index=True)
    title: str
    details: str = ""
    completed: bool = False
    priority: Priority = Priority.medium
    due_date: date | None = None
    position: int
    created_at: datetime = Field(default_factory=utcnow)

    column: BoardColumn = Relationship(back_populates="cards")
    checklist: list["ChecklistItem"] = Relationship(
        back_populates="card",
        cascade_delete=True,
        sa_relationship_kwargs={"order_by": "ChecklistItem.position"},
    )
    labels: list["Label"] = Relationship(back_populates="cards", link_model=CardLabel)


class ChecklistItem(SQLModel, table=True):
    __tablename__ = "checklist_items"

    id: int | None = Field(default=None, primary_key=True)
    card_id: int = Field(foreign_key="cards.id", ondelete="CASCADE", index=True)
    text: str
    done: bool = False
    position: int

    card: Card = Relationship(back_populates="checklist")


class Label(SQLModel, table=True):
    __tablename__ = "labels"

    id: int | None = Field(default=None, primary_key=True)
    board_id: int = Field(foreign_key="boards.id", ondelete="CASCADE", index=True)
    name: str
    color: LabelColor

    board: Board = Relationship(back_populates="labels")
    cards: list[Card] = Relationship(back_populates="labels", link_model=CardLabel)
