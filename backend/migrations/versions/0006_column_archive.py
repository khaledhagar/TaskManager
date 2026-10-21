"""Archived columns (Phase 26 fixes).

Revision ID: 0006_column_archive
Revises: 0005_workspaces
"""

import sqlalchemy as sa
import sqlmodel
from alembic import op

revision = "0006_column_archive"
down_revision = "0005_workspaces"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("columns", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("archived_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("columns", schema=None) as batch_op:
        batch_op.drop_column("archived_at")
