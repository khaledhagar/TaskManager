"""Shared fixtures: an app wired to a temporary frontend build."""

import os

import pytest
from fastapi.testclient import TestClient
from helpers import FakeLLM
from sqlmodel import Session

from app import ai, ratelimit, users
from app.config import Settings

os.environ.setdefault("JWT_SECRET", "test-" + "x" * 60)


@pytest.fixture(autouse=True)
def example_cards(request, monkeypatch):
    """New accounts in tests get the demo board's example cards as test data.

    Tests marked `real_start` see the real first board: empty columns.
    """
    if request.node.get_closest_marker("real_start"):
        return
    build = users.build_board
    monkeypatch.setattr(users, "build_board", lambda s, uid, name, empty: build(s, uid, name))


@pytest.fixture
def dist(tmp_path):
    """A fake frontend build with an index page and one asset."""
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<html>spa</html>")
    (tmp_path / "assets" / "app.js").write_text("console.log(1)")
    return tmp_path


# Set to a Postgres test database to run every test against Postgres (Phase 28).
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")


_built = False


def empty_postgres(url: str) -> None:
    """Start each test from an empty database, like the SQLite file.

    The first test drops everything (the app then builds the tables); later tests only empty the
    tables, which is much faster over the network.
    """
    global _built
    from sqlalchemy import create_engine, text

    from app.db import engine_url

    engine = create_engine(engine_url(url))
    with engine.begin() as conn:
        if not _built:
            conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public"))
        else:
            names = conn.execute(
                text(
                    "SELECT string_agg(quote_ident(tablename), ', ') FROM pg_tables "
                    "WHERE schemaname = 'public' AND tablename <> 'alembic_version'"
                )
            ).scalar()
            conn.execute(text(f"TRUNCATE {names} RESTART IDENTITY CASCADE"))
    engine.dispose()
    _built = True


@pytest.fixture
def settings(dist, tmp_path):
    if TEST_DATABASE_URL:
        empty_postgres(TEST_DATABASE_URL)
    return Settings(
        jwt_secret="x" * 64,
        frontend_dist=dist,
        database_url=TEST_DATABASE_URL or f"sqlite:///{tmp_path / 'test.db'}",
        app_url="http://app.test",
        storage_dir=tmp_path / "storage",
    )


@pytest.fixture
def session(settings):
    from app.db import make_engine

    engine = make_engine(settings.database_url)
    with Session(engine) as s:
        yield s
    engine.dispose()


@pytest.fixture
def client(settings):
    from app.factory import create_app

    app = create_app(settings)
    with TestClient(app) as c:
        yield c
    app.state.engine.dispose()


@pytest.fixture
def llm(monkeypatch):
    """The model, faked; AI rate limits lifted (they have their own tests)."""
    fake = FakeLLM()
    monkeypatch.setattr(ai, "complete", fake)
    monkeypatch.setattr(ratelimit, "AI_PER_MINUTE", ratelimit.Limit(1000, 60))
    monkeypatch.setattr(ratelimit, "AI_PER_DAY", ratelimit.Limit(1000, 86400))
    return fake
