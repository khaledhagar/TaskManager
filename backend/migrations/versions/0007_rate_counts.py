"""Rate-limit counters in the database (Phase 28).

Revision ID: 0007_rate_counts
Revises: 0006_column_archive
"""

import sqlalchemy as sa
import sqlmodel
from alembic import op

revision = "0007_rate_counts"
down_revision = "0006_column_archive"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "rate_counts",
        sa.Column("key", sqlmodel.sql.sqltypes.AutoString(length=400), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.Float(), nullable=False),
        sa.PrimaryKeyConstraint("key"),
    )
    op.create_index(op.f("ix_rate_counts_expires_at"), "rate_counts", ["expires_at"])


def downgrade() -> None:
    op.drop_index(op.f("ix_rate_counts_expires_at"), table_name="rate_counts")
    op.drop_table("rate_counts")
