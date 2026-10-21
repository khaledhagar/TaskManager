"""Alembic environment: migrate the app's tables on the connection the app hands over."""

from alembic import context
from sqlmodel import SQLModel, create_engine

from app import models  # noqa: F401  (registers every table)
from app.config import load_settings

target_metadata = SQLModel.metadata


def run(connection) -> None:
    # Batch mode lets SQLite alter tables (it copies them); Postgres alters in place.
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        render_as_batch=True,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


connection = context.config.attributes.get("connection")
if connection is not None:
    run(connection)
else:
    with create_engine(load_settings().database_url).begin() as conn:
        run(conn)
