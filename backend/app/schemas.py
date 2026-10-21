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


class ColumnOut(BaseModel):
    id: int
    title: str
    position: int
    cards: list[CardOut]


class BoardSummary(BaseModel):
    id: int
    title: str
    created_at: datetime
    role: Role


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


class MemberBrief(BaseModel):
    user_id: int
    email: str | None


class PublicCardOut(BaseModel):
    """A card on a public board: no attachments, no assignees."""

    id: int
    title: str
    details: str
    completed: bool
    priority: Priority
    due_date: date | None
    label_ids: list[int]
    checklist: list[ItemOut]


class PublicColumnOut(BaseModel):
    id: int
    title: str
    cards: list[PublicCardOut]


class PublicBoardOut(BaseModel):
    """What anyone with the link sees: no board id, members, files or AI."""

    title: str
    labels: list[LabelOut]
    columns: list[PublicColumnOut]
    background: BackgroundOut


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
    )


def column_out(column: BoardColumn, counts: dict[int, int] | None = None) -> ColumnOut:
    return ColumnOut(
        id=column.id,
        title=column.title,
        position=column.position,
        cards=[card_out(c, (counts or {}).get(c.id, 0)) for c in column.cards],
    )


def board_summary(board: Board, role: Role) -> BoardSummary:
    return BoardSummary(id=board.id, title=board.title, created_at=board.created_at, role=role)


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
    )


def public_board_out(board: Board) -> PublicBoardOut:
    return PublicBoardOut(
        title=board.title,
        labels=[LabelOut.model_validate(lbl) for lbl in board.labels],
        columns=[
            PublicColumnOut(
                id=col.id,
                title=col.title,
                cards=[
                    PublicCardOut(
                        id=c.id,
                        title=c.title,
                        details=c.details,
                        completed=c.completed,
                        priority=c.priority,
                        due_date=c.due_date,
                        label_ids=sorted(lbl.id for lbl in c.labels),
                        checklist=[ItemOut.model_validate(i) for i in c.checklist],
                    )
                    for c in col.cards
                ],
            )
            for col in board.columns
        ],
        background=background_out(board),
    )


def background_out(board: Board) -> BackgroundOut:
    return BackgroundOut(
        kind=board.background_kind,
        preset=board.background_preset,
        version=board.background_version,
    )
