"""Shared fixtures: an app wired to a temporary frontend build."""

import os

import pytest
from fastapi.testclient import TestClient

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
def settings(dist):
    return Settings(jwt_secret="x" * 64, frontend_dist=dist)


@pytest.fixture
def client(settings):
    from app.main import create_app

    with TestClient(create_app(settings)) as c:
        yield c
