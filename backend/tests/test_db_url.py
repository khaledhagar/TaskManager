"""Database addresses from hosting providers use the psycopg 3 driver (Phase 28)."""

import pytest

from app.db import engine_url


@pytest.mark.parametrize(
    ("given", "used"),
    [
        ("postgresql://u:p@host:5432/db", "postgresql+psycopg://u:p@host:5432/db"),
        ("postgres://u:p@host:5432/db", "postgresql+psycopg://u:p@host:5432/db"),
        ("postgresql+psycopg://u:p@host/db", "postgresql+psycopg://u:p@host/db"),
        ("sqlite:///x.db", "sqlite:///x.db"),
    ],
)
def test_postgres_addresses_use_psycopg(given, used):
    assert engine_url(given) == used
