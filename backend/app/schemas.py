"""Request and response models for the board API."""

from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.models import Board, BoardColumn, Card, LabelColor, Priority, Role


def text(max_length: int, min_length: int = 1):
    return Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=min_length, max_length=max_length)
    ]


Title = text(200)
Details = text(10_000, min_length=0)
ItemText = text(300)
LabelName = text(40)
Template = Literal["blank", "sprint", "bug_tracking", "personal"]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class BoardCreate(Strict):
    title: Title | None = None
    template: Template = "blank"
    template_id: int | None = None
    # Chosen column names: the board starts with them and no cards (Phase 26).
    columns: list[Title] | None = Field(default=None, min_length=1, max_length=20)
    workspace_id: int | None = None


class TitleUpdate(Strict):
    title: Title


class ColumnOrder(Strict):
    column_ids: list[int] = Field(max_length=100)


class CardCreate(Strict):
    title: Title
    details: Details = ""
    priority: Priority = Priority.medium
    due_date: date | None = None


class CardUpdate(Strict):
    title: Title | None = None
    details: Details | None = None
    completed: bool | None = None
    priority: Priority | None = None
    due_date: date | None = None


class CardAssignees(Strict):
    user_ids: list[int] = Field(max_length=50)


class CardMove(Strict):
    column_id: int
    position: int = Field(ge=0)


class CardLabels(Strict):
    label_ids: list[int] = Field(max_length=30)


class ItemCreate(Strict):
    text: ItemText


class ItemUpdate(Strict):
    text: ItemText | None = None
    done: bool | None = None


class LabelCreate(Strict):
    name: LabelName
    color: LabelColor


class ItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    text: str
    done: bool
    position: int


class LabelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    color: LabelColor


class AttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    filename: str
    content_type: str
    size: int
    is_image: bool
    created_at: datetime


class BackgroundOut(BaseModel):
    kind: str
    preset: str | None
    version: int


class CardOut(BaseModel):
    id: int
    title: str
    details: str
    completed: bool
    priority: Priority
    due_date: date | None
    position: int
    label_ids: list[int]
    checklist: list[ItemOut]
    attachments: list[AttachmentOut]
    assignee_ids: list[int]
    comment_count: int = 0
    cover_attachment_id: int | None = None
    focus_count: int = 0
    focus_minutes: int = 0


class ColumnOut(BaseModel):
    id: int
    title: str
    position: int
    wip_limit: int | None
    cards: list[CardOut]


class BoardSummary(BaseModel):
    id: int
    title: str
    created_at: datetime
    role: Role
    archived: bool = False
    starred: bool = False
    workspace_id: int | None = None
    # Progress for the start screen: active cards and how many are done.
    cards: int = 0
    done: int = 0


class BoardOut(BaseModel):
    id: int
    title: str
    labels: list[LabelOut]
    columns: list[ColumnOut]
    background: BackgroundOut
    role: Role
    public: bool
    public_link: str | None
    meeting_url: str | None
    members: list["MemberBrief"]
    archived: bool
    auto_complete: bool
    workspace_id: int | None = None


class MemberBrief(BaseModel):
    user_id: int
    email: str | None


def card_out(card: Card, comments: int = 0) -> CardOut:
    return CardOut(
        id=card.id,
        title=card.title,
        details=card.details,
        completed=card.completed,
        priority=card.priority,
        due_date=card.due_date,
        position=card.position,
        label_ids=sorted(label.id for label in card.labels),
        checklist=[ItemOut.model_validate(i) for i in card.checklist],
        attachments=[AttachmentOut.model_validate(a) for a in card.attachments],
        assignee_ids=sorted(u.id for u in card.assignees),
        comment_count=comments,
        cover_attachment_id=card.cover_attachment_id,
        focus_count=len(card.focus_sessions),
        focus_minutes=sum(f.minutes for f in card.focus_sessions),
    )


def column_out(column: BoardColumn, counts: dict[int, int] | None = None) -> ColumnOut:
    return ColumnOut(
        id=column.id,
        title=column.title,
        position=column.position,
        wip_limit=column.wip_limit,
        cards=[card_out(c, (counts or {}).get(c.id, 0)) for c in column.cards],
    )


def board_summary(
    board: Board, role: Role, starred: bool = False, workspace_id: int | None = None
) -> BoardSummary:
    """`workspace_id` only when the workspace is the viewer's own (workspaces are private)."""
    return BoardSummary(
        id=board.id,
        title=board.title,
        created_at=board.created_at,
        role=role,
        archived=board.archived_at is not None,
        starred=starred,
        workspace_id=workspace_id,
    )


def public_url(app_url: str, token: str) -> str:
    return f"{app_url}/p/{token}"


def board_out(
    board: Board, role: Role, app_url: str, comment_counts: dict[int, int] | None = None
) -> BoardOut:
    """The full board; only the admin gets the public link."""
    link = board.public_link
    return BoardOut(
        id=board.id,
        title=board.title,
        labels=[LabelOut.model_validate(lbl) for lbl in board.labels],
        columns=[column_out(c, comment_counts) for c in board.columns],
        background=background_out(board),
        role=role,
        public=link is not None,
        public_link=public_url(app_url, link.token) if link and role == Role.admin else None,
        meeting_url=board.meeting_link.url if board.meeting_link else None,
        members=[MemberBrief(user_id=m.user_id, email=m.user.email) for m in board.members],
        archived=board.archived_at is not None,
        auto_complete=board.auto_complete,
    )


def background_out(board: Board) -> BackgroundOut:
    return BackgroundOut(
        kind=board.background_kind,
        preset=board.background_preset,
        version=board.background_version,
    )
