"""Bring the database up to date with Alembic (Phase 22).

- A new, empty database gets every table at once and is marked as up to date.
- A database made before Alembic (it has tables but no version) is marked as the baseline,
  then upgraded, so existing local databases keep their data.
- Otherwise the pending migrations run; an up-to-date database is left alone.
"""

from functools import cache
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import Engine
from sqlmodel import SQLModel

MIGRATIONS = Path(__file__).resolve().parents[1] / "migrations"
BASELINE = "0001_baseline"


def alembic_config(connection) -> Config:
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS))
    config.attributes["connection"] = connection
    return config


@cache
def scripts() -> ScriptDirectory:
    """The migration scripts, read once per process (reading them takes about 200 ms)."""
    return ScriptDirectory(str(MIGRATIONS))


def migrate(engine: Engine) -> None:
    with engine.begin() as connection:
        context = MigrationContext.configure(connection)
        current = context.get_current_revision()
        head = scripts().get_current_head()
        if current == head:
            return
        if current is None and not engine.dialect.has_table(connection, "users"):
            SQLModel.metadata.create_all(connection)
            context.stamp(scripts(), head)
            return
        config = alembic_config(connection)
        if current is None:
            command.stamp(config, BASELINE)
        command.upgrade(config, "head")
