"""Rate-limit counters stored in the database, shared by every server instance (Phase 28)."""

from sqlmodel import Field, SQLModel


class RateCount(SQLModel, table=True):
    """Hits for one key in one time window; removed once `expires_at` (Unix time) has passed."""

    __tablename__ = "rate_counts"

    key: str = Field(primary_key=True, max_length=400)
    count: int
    expires_at: float = Field(index=True)
