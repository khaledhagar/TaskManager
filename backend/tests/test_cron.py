"""Scheduled jobs: Vercel Cron calls them with GET and the CRON_SECRET header (Phase 28)."""

from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest
from sqlmodel import Session, select

from app.models import Heartbeat, RateCount, User

SECRET = "s" * 32
AUTH = {"Authorization": f"Bearer {SECRET}"}


@pytest.fixture
def cron(client):
    client.app.state.settings = replace(client.app.state.settings, cron_secret=SECRET)
    return client


@pytest.mark.parametrize("url", ["/api/cron/reminders", "/api/cron/cleanup"])
def test_jobs_need_the_secret(client, url):
    assert client.get(url).status_code == 404
    client.app.state.settings = replace(client.app.state.settings, cron_secret=SECRET)
    assert client.get(url).status_code == 401
    assert client.get(url, headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert client.get(url, headers=AUTH).status_code == 200


def test_cleanup_removes_old_guests_and_ended_counters(cron):
    with Session(cron.app.state.engine) as s:
        s.add(User(is_guest=True, created_at=datetime.now(UTC) - timedelta(days=8)))
        s.add(User(is_guest=True))
        s.add(RateCount(key="old", count=1, expires_at=1.0))
        s.add(RateCount(key="new", count=1, expires_at=datetime.now(UTC).timestamp() + 60))
        s.commit()
    body = cron.get("/api/cron/cleanup", headers=AUTH).json()
    assert (body["guests"], body["counters"]) == (1, 1)
    with Session(cron.app.state.engine) as s:
        assert [r.key for r in s.exec(select(RateCount))] == ["new"]
        assert len(s.exec(select(User)).all()) == 1


def test_reminders_report_the_emails_sent(cron):
    assert cron.get("/api/cron/reminders", headers=AUTH).json() == {"emails": 0}


def test_cleanup_writes_one_heartbeat_row_each_run(cron):
    """A daily write keeps the free Supabase project from pausing after a quiet week (T-840)."""
    first = cron.get("/api/cron/cleanup", headers=AUTH).json()["heartbeat"]
    second = cron.get("/api/cron/cleanup", headers=AUTH).json()["heartbeat"]
    assert second > first
    with Session(cron.app.state.engine) as s:
        rows = s.exec(select(Heartbeat)).all()
        assert [(r.name, r.at.isoformat()) for r in rows] == [("cron", second)]
