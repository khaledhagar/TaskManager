"""Tables for running the site (Phase 28): shared rate-limit counters and the daily heartbeat."""

from datetime import datetime

from sqlmodel import Field, SQLModel


class RateCount(SQLModel, table=True):
    """Hits for one key in one time window; removed once `expires_at` (Unix time) has passed."""

    __tablename__ = "rate_counts"

    key: str = Field(primary_key=True, max_length=400)
    count: int
    expires_at: float = Field(index=True)


class Heartbeat(SQLModel, table=True):
    """When a scheduled job last ran; its daily write keeps the free Supabase project awake."""

    __tablename__ = "heartbeats"

    name: str = Field(primary_key=True, max_length=40)
    at: datetime
