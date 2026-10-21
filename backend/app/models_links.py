"""A board's public link and meeting link (Phase 20)."""

from sqlmodel import Field, SQLModel


class PublicLink(SQLModel, table=True):
    """A board is public while it has this row; its token is the read-only link."""

    __tablename__ = "public_links"

    id: int | None = Field(default=None, primary_key=True)
    board_id: int = Field(foreign_key="boards.id", ondelete="CASCADE", unique=True)
    token: str = Field(unique=True, index=True)


class MeetingLink(SQLModel, table=True):
    """The board's https meeting link (Zoom, Meet, Teams or any other)."""

    __tablename__ = "meeting_links"

    id: int | None = Field(default=None, primary_key=True)
    board_id: int = Field(foreign_key="boards.id", ondelete="CASCADE", unique=True)
    url: str
