"""Request and response models for Phase 24 (archive, templates, WIP, covers, focus)."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas import BoardSummary, Strict, Title, text


class BoardUpdate(Strict):
    title: Title | None = None
    auto_complete: bool | None = None
    workspace_id: int | None = None


WorkspaceName = text(100)


class NewBoard(Strict):
    title: Title
    columns: list[Title] = Field(min_length=1, max_length=20)


class WorkspaceCreate(Strict):
    name: WorkspaceName
    boards: list[NewBoard] = Field(default_factory=list, max_length=10)


class WorkspaceUpdate(Strict):
    name: WorkspaceName


class WorkspaceOut(BaseModel):
    id: int
    name: str
    created_at: datetime


class MemberBrief(BaseModel):
    email: str | None
    role: str


class BoardMembers(BaseModel):
    board_id: int
    title: str
    members: list[MemberBrief]


class WorkspaceCreated(BaseModel):
    workspace: WorkspaceOut
    boards: list[BoardSummary]


class ColumnUpdate(Strict):
    title: Title | None = None
    wip_limit: int | None = Field(default=None, ge=1, le=100)


class TemplateCreate(Strict):
    board_id: int
    name: Title


class TemplateOut(BaseModel):
    id: int
    name: str
    created_at: datetime


class CoverSet(Strict):
    attachment_id: int | None


class FocusCreate(Strict):
    minutes: int = Field(ge=1, le=60)


class FocusOut(BaseModel):
    focus_count: int
    focus_minutes: int


class ArchivedColumnOut(BaseModel):
    id: int
    title: str
    cards: int
    archived_at: datetime


class ArchivedCardOut(BaseModel):
    id: int
    title: str
    column_id: int
    column_title: str
    archived_at: datetime
