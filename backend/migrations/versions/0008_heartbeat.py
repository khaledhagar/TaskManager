"""Daily heartbeat written by the cleanup job (Phase 28).

Revision ID: 0008_heartbeat
Revises: 0007_rate_counts
"""

import sqlalchemy as sa
import sqlmodel
from alembic import op

revision = "0008_heartbeat"
down_revision = "0007_rate_counts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "heartbeats",
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(length=40), nullable=False),
        sa.Column("at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.PrimaryKeyConstraint("name"),
    )


def downgrade() -> None:
    op.drop_table("heartbeats")
