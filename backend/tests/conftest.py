"""Shared fixtures: an app wired to a temporary frontend build."""

import os

import pytest
from fastapi.testclient import TestClient
from helpers import FakeLLM
from sqlmodel import Session

from app import ai, ratelimit
from app.config import Settings

os.environ.setdefault("JWT_SECRET", "test-" + "x" * 60)


@pytest.fixture
def dist(tmp_path):
    """A fake frontend build with an index page and one asset."""
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<html>spa</html>")
    (tmp_path / "assets" / "app.js").write_text("console.log(1)")
    return tmp_path


@pytest.fixture
def settings(dist, tmp_path):
    return Settings(
        jwt_secret="x" * 64,
        frontend_dist=dist,
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
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
