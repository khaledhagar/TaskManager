"""Scheduled jobs: Vercel Cron calls them with GET and the CRON_SECRET header (Phase 28)."""

from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest
from sqlmodel import Session, select

from app.models import RateCount, User

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
    assert cron.get("/api/cron/cleanup", headers=AUTH).json() == {"guests": 1, "counters": 1}
    with Session(cron.app.state.engine) as s:
        assert [r.key for r in s.exec(select(RateCount))] == ["new"]
        assert len(s.exec(select(User)).all()) == 1


def test_reminders_report_the_emails_sent(cron):
    assert cron.get("/api/cron/reminders", headers=AUTH).json() == {"emails": 0}
