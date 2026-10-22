"""Rate-limit counters in the database, shared by every server instance (Phase 28)."""

from sqlmodel import Session, select

from app.db import make_engine
from app.models import RateCount
from app.ratelimit import DbStore, MemoryStore, RateLimiter, drop_expired, make_store


def test_counts_per_key_until_the_window_ends(settings):
    engine = make_engine(settings.database_url)
    store = DbStore(engine)
    assert store.increment("a", expires=100.0, now=10.0) == 1
    assert store.increment("a", expires=100.0, now=11.0) == 2
    assert store.increment("b", expires=100.0, now=12.0) == 1
    engine.dispose()


def test_a_limiter_on_the_database_blocks_after_the_limit(settings):
    engine = make_engine(settings.database_url)
    limiter = RateLimiter(DbStore(engine), clock=lambda: 1000.0)
    assert [limiter.allow("ip:1", 2, 60) for _ in range(3)] == [True, True, False]
    engine.dispose()


def test_expired_counters_are_removed(settings):
    engine = make_engine(settings.database_url)
    store = DbStore(engine)
    store.increment("old", expires=50.0, now=10.0)
    store.increment("new", expires=500.0, now=10.0)
    with Session(engine) as session:
        assert drop_expired(session, now=100.0) == 1
        assert [r.key for r in session.exec(select(RateCount))] == ["new"]
    engine.dispose()


def test_postgres_uses_the_database_store_and_sqlite_the_memory_one(settings):
    engine = make_engine(settings.database_url)
    assert isinstance(make_store("sqlite:///x.db", engine), MemoryStore)
    assert isinstance(make_store("postgresql://u:p@host/db", engine), DbStore)
    engine.dispose()


def test_on_vercel_the_visitor_ip_comes_from_x_real_ip(client):
    """Vercel overwrites x-real-ip with the visitor's address; elsewhere it could be faked."""
    from dataclasses import replace

    from starlette.requests import Request

    from app.ratelimit import client_ip

    def request(app):
        scope = {
            "type": "http",
            "app": app,
            "client": ("10.0.0.1", 1),
            "headers": [(b"x-real-ip", b"203.0.113.9")],
        }
        return Request(scope)

    assert client_ip(request(client.app)) == "10.0.0.1"
    client.app.state.settings = replace(client.app.state.settings, on_vercel=True)
    assert client_ip(request(client.app)) == "203.0.113.9"
