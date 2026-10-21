"""Alembic migrations (T-640, T-695)."""

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect, text
from sqlmodel import SQLModel

from app.migrate import BASELINE, MIGRATIONS, alembic_config, migrate


def head() -> str:
    config = alembic_config(None)
    return ScriptDirectory.from_config(config).get_current_head()


def version(engine) -> str:
    with engine.connect() as conn:
        return conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one()


def test_migrations_build_exactly_the_models(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'm.db'}")
    with engine.begin() as conn:
        command.upgrade(alembic_config(conn), "head")
    with engine.connect() as conn:
        diff = compare_metadata(MigrationContext.configure(conn), SQLModel.metadata)
    assert diff == []


def test_new_database_gets_every_table_and_is_up_to_date(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'new.db'}")
    migrate(engine)
    assert {"users", "boards", "cards"} <= set(inspect(engine).get_table_names())
    assert version(engine) == head()


def test_database_made_before_alembic_keeps_its_data(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'old.db'}")
    with engine.begin() as conn:
        command.upgrade(alembic_config(conn), BASELINE)
        conn.execute(text("DROP TABLE alembic_version"))
        conn.execute(
            text(
                "INSERT INTO users (email, is_guest, email_verified, token_version, language,"
                " created_at) VALUES ('old@example.com', 0, 1, 0, 'en', '2026-10-01')"
            )
        )
    migrate(engine)
    assert version(engine) == head()
    with engine.connect() as conn:
        assert conn.execute(text("SELECT email FROM users")).scalar_one() == "old@example.com"


def test_running_twice_changes_nothing(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'twice.db'}")
    migrate(engine)
    migrate(engine)
    assert version(engine) == head()


def test_migration_files_live_in_the_backend():
    assert (MIGRATIONS / "env.py").exists()
    assert any((MIGRATIONS / "versions").glob("0001_baseline_*.py"))
