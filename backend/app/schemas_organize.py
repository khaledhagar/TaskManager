"""Request and response models for Phase 24 (archive, templates, WIP, covers, focus)."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas import Strict, Title


class BoardUpdate(Strict):
    title: Title | None = None
    auto_complete: bool | None = None


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


class ArchivedCardOut(BaseModel):
    id: int
    title: str
    column_id: int
    column_title: str
    archived_at: datetime
