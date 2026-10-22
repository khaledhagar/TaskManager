"""Database tables: users, boards, members, invites, columns, cards, checklist items and labels."""

from datetime import UTC, date, datetime
from enum import StrEnum

from sqlalchemy import UniqueConstraint, false
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


class Role(StrEnum):
    """A member's permission on a board, lowest first (see Board Sharing Design)."""

    viewer = "viewer"
    updater = "updater"
    editor = "editor"
    admin = "admin"


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: int | None = Field(default=None, primary_key=True)
    email: str | None = Field(default=None, unique=True, index=True)
    password_hash: str | None = None
    is_guest: bool = False
    email_verified: bool = False
    google_id: str | None = Field(default=None, unique=True, index=True)
    token_version: int = 0
    language: str = "en"
    created_at: datetime = Field(default_factory=utcnow)

    boards: list["Board"] = Relationship(back_populates="owner", cascade_delete=True)
    email_tokens: list["EmailToken"] = Relationship(cascade_delete=True)
    memberships: list["BoardMember"] = Relationship(back_populates="user", cascade_delete=True)


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

    background_kind: str = "none"
    background_preset: str | None = None
    background_key: str | None = None
    background_size: int = 0
    background_version: int = 0
    archived_at: datetime | None = None
    workspace_id: int | None = Field(default=None, foreign_key="workspaces.id", ondelete="SET NULL")
    auto_complete: bool = Field(default=False, sa_column_kwargs={"server_default": false()})

    owner: User = Relationship(back_populates="boards")
    # Only columns that are not archived; archived ones are still deleted with the board.
    columns: list["BoardColumn"] = Relationship(
        back_populates="board",
        cascade_delete=True,
        sa_relationship_kwargs={
            "order_by": "BoardColumn.position",
            "primaryjoin": "and_(Board.id == BoardColumn.board_id, BoardColumn.archived_at == None)",  # noqa: E501
        },
    )
    archived_columns: list["BoardColumn"] = Relationship(
        cascade_delete=True,
        sa_relationship_kwargs={
            "primaryjoin": "and_(Board.id == BoardColumn.board_id, BoardColumn.archived_at != None)",  # noqa: E501
            "overlaps": "columns,board",
        },
    )
    labels: list["Label"] = Relationship(back_populates="board", cascade_delete=True)
    members: list["BoardMember"] = Relationship(
        cascade_delete=True, sa_relationship_kwargs={"order_by": "BoardMember.id"}
    )
    invites: list["BoardInvite"] = Relationship(cascade_delete=True)
    access_requests: list["AccessRequest"] = Relationship(cascade_delete=True)
    public_link: "PublicLink" = Relationship(
        cascade_delete=True, sa_relationship_kwargs={"uselist": False}
    )
    meeting_link: "MeetingLink" = Relationship(
        cascade_delete=True, sa_relationship_kwargs={"uselist": False}
    )


class BoardMember(SQLModel, table=True):
    """A user's role on a board; the board's creator has the admin row."""

    __tablename__ = "board_members"
    __table_args__ = (UniqueConstraint("board_id", "user_id"),)

    id: int | None = Field(default=None, primary_key=True)
    board_id: int = Field(foreign_key="boards.id", ondelete="CASCADE", index=True)
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    role: Role = Role.viewer
    created_at: datetime = Field(default_factory=utcnow)

    user: User = Relationship(back_populates="memberships")


class BoardInvite(SQLModel, table=True):
    """Emailed invitation to a board; only the SHA-256 hash of its token is stored."""

    __tablename__ = "board_invites"

    id: int | None = Field(default=None, primary_key=True)
    board_id: int = Field(foreign_key="boards.id", ondelete="CASCADE", index=True)
    invited_by: int = Field(foreign_key="users.id", ondelete="CASCADE")
    email: str = Field(index=True)
    token_hash: str = Field(unique=True, index=True)
    expires_at: datetime
    used_at: datetime | None = None
    created_at: datetime = Field(default_factory=utcnow)


class AccessRequest(SQLModel, table=True):
    """A member asking the admin for more access; one per member per board."""

    __tablename__ = "access_requests"
    __table_args__ = (UniqueConstraint("board_id", "user_id"),)

    id: int | None = Field(default=None, primary_key=True)
    board_id: int = Field(foreign_key="boards.id", ondelete="CASCADE", index=True)
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    created_at: datetime = Field(default_factory=utcnow)

    user: User = Relationship()


class BoardColumn(SQLModel, table=True):
    __tablename__ = "columns"

    id: int | None = Field(default=None, primary_key=True)
    board_id: int = Field(foreign_key="boards.id", ondelete="CASCADE", index=True)
    title: str
    position: int
    wip_limit: int | None = None
    archived_at: datetime | None = None

    board: Board = Relationship(back_populates="columns")
    # Only cards that are not archived: archived ones leave the board, its limit and its order.
    cards: list["Card"] = Relationship(
        back_populates="column",
        cascade_delete=True,
        sa_relationship_kwargs={
            "order_by": "Card.position",
            "primaryjoin": "and_(BoardColumn.id == Card.column_id, Card.archived_at == None)",
        },
    )
    # Deleting a column deletes its archived cards one by one too, so their files are removed.
    archived_cards: list["Card"] = Relationship(
        cascade_delete=True,
        sa_relationship_kwargs={
            "primaryjoin": "and_(BoardColumn.id == Card.column_id, Card.archived_at != None)",
            "overlaps": "cards,column",
        },
    )


class CardLabel(SQLModel, table=True):
    __tablename__ = "card_labels"

    card_id: int = Field(foreign_key="cards.id", ondelete="CASCADE", primary_key=True)
    label_id: int = Field(foreign_key="labels.id", ondelete="CASCADE", primary_key=True)


class CardAssignee(SQLModel, table=True):
    __tablename__ = "card_assignees"

    card_id: int = Field(foreign_key="cards.id", ondelete="CASCADE", primary_key=True)
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", primary_key=True)


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
    archived_at: datetime | None = None
    cover_attachment_id: int | None = None

    column: BoardColumn = Relationship(back_populates="cards")
    checklist: list["ChecklistItem"] = Relationship(
        back_populates="card",
        cascade_delete=True,
        sa_relationship_kwargs={"order_by": "ChecklistItem.position"},
    )
    labels: list["Label"] = Relationship(back_populates="cards", link_model=CardLabel)
    assignees: list[User] = Relationship(link_model=CardAssignee)
    attachments: list["Attachment"] = Relationship(
        back_populates="card",
        cascade_delete=True,
        sa_relationship_kwargs={"order_by": "Attachment.id"},
    )
    focus_sessions: list["FocusSession"] = Relationship(cascade_delete=True)


class Attachment(SQLModel, table=True):
    """File attached to a card; bytes live in storage under a random key."""

    __tablename__ = "attachments"

    id: int | None = Field(default=None, primary_key=True)
    card_id: int = Field(foreign_key="cards.id", ondelete="CASCADE", index=True)
    owner_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    filename: str
    content_type: str
    size: int
    is_image: bool = False
    storage_key: str = Field(unique=True)
    created_at: datetime = Field(default_factory=utcnow)

    card: Card = Relationship(back_populates="attachments")


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


# Collaboration tables (Phase 22) live in their own module to keep this one short.
from app.models_collab import Activity, Comment  # noqa: E402, F401
from app.models_links import MeetingLink, PublicLink  # noqa: E402, F401
from app.models_notify import Notification, NotificationSetting  # noqa: E402, F401
from app.models_organize import BoardStar, FocusSession, UserTemplate, Workspace  # noqa: E402, F401
from app.models_rate import Heartbeat, RateCount  # noqa: E402, F401
