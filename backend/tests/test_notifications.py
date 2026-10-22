"""Notifications, emails, reminders, the scheduled job (T-645, T-660 to T-675; SEC-202-204)."""

import os
import subprocess
import sys
from datetime import date, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from helpers import first_board, outbox, sign_up
from sharing_helpers import join, user_id
from sqlmodel import Session

from app.jobs import send_reminders
from app.notify import unsubscribe_token


@pytest.fixture
def alice(client):
    sign_up(client, "alice@example.com")
    return client


@pytest.fixture
def bob(alice):
    with TestClient(alice.app) as c:
        sign_up(c, "bob@example.com")
        yield c


@pytest.fixture
def shared(alice, bob):
    board = first_board(alice)
    bob_id = join(alice, bob, board["id"], "bob@example.com", "editor")
    card = board["columns"][0]["cards"][0]
    return {"board": board["id"], "card": card["id"], "title": card["title"], "bob": bob_id}


def notes(client):
    return client.get("/api/notifications").json()


def mails_to(client, email):
    return [m for m in outbox(client) if m.to == email]


def run_reminders(client, today=None):
    with Session(client.app.state.engine) as s:
        return send_reminders(
            s, client.app.state.mailer, client.app.state.settings, today or date.today()
        )


def test_assignment_notifies_in_app_and_by_email(alice, bob, shared):
    before = len(mails_to(alice, "bob@example.com"))
    alice.put(f"/api/cards/{shared['card']}/assignees", json={"user_ids": [shared["bob"]]})
    data = notes(bob)
    assert data["unread"] == 1
    item = data["items"][0]
    assert item["kind"] == "assigned"
    assert item["actor_email"] == "alice@example.com"
    assert item["card_id"] == shared["card"] and item["board_id"] == shared["board"]
    assert item["data"]["title"] == shared["title"]
    mails = mails_to(alice, "bob@example.com")
    assert len(mails) == before + 1 and shared["title"] in mails[-1].text
    alice.put(f"/api/cards/{shared['card']}/assignees", json={"user_ids": [shared["bob"]]})
    assert notes(bob)["unread"] == 1


def test_assigning_yourself_sends_nothing(alice, shared):
    alice.put(f"/api/cards/{shared['card']}/assignees", json={"user_ids": [user_id(alice)]})
    assert notes(alice)["unread"] == 0


def test_mention_notifies_the_member(alice, bob, shared):
    alice.post(f"/api/cards/{shared['card']}/comments", json={"text": "Look @bob@example.com"})
    item = notes(bob)["items"][0]
    assert item["kind"] == "mentioned"
    assert mails_to(alice, "bob@example.com")[-1].subject.startswith(
        "alice@example.com mentioned you"
    )


def test_read_one_and_read_all(alice, bob, shared):
    for _ in range(2):
        alice.post(f"/api/cards/{shared['card']}/comments", json={"text": "@bob@example.com"})
    items = notes(bob)["items"]
    assert bob.post(f"/api/notifications/{items[0]['id']}/read").status_code == 204
    assert notes(bob)["unread"] == 1
    assert bob.post("/api/notifications/read-all").status_code == 204
    assert notes(bob)["unread"] == 0
    assert alice.post(f"/api/notifications/{items[1]['id']}/read").status_code == 404


def test_removed_members_no_longer_see_board_notifications(alice, bob, shared):
    alice.post(f"/api/cards/{shared['card']}/comments", json={"text": "@bob@example.com"})
    alice.delete(f"/api/boards/{shared['board']}/members/{shared['bob']}")
    assert notes(bob) == {"unread": 0, "items": []}


def test_email_setting_and_unsubscribe_link(alice, bob, shared):
    assert bob.get("/api/notifications/settings").json() == {"email": True}
    assert bob.patch("/api/notifications/settings", json={"email": False}).json() == {
        "email": False
    }
    before = len(mails_to(alice, "bob@example.com"))
    alice.post(f"/api/cards/{shared['card']}/comments", json={"text": "@bob@example.com"})
    assert len(mails_to(alice, "bob@example.com")) == before
    assert notes(bob)["unread"] == 1
    bob.patch("/api/notifications/settings", json={"email": True})
    alice.post(f"/api/cards/{shared['card']}/comments", json={"text": "@bob@example.com"})
    mail = mails_to(alice, "bob@example.com")[-1]
    token = mail.text.split("/unsubscribe#token=")[1].split()[0]
    with TestClient(alice.app) as anonymous:
        assert (
            anonymous.post("/api/notifications/unsubscribe", json={"token": token}).status_code
            == 204
        )
        bad = token[:-2] + ("aa" if not token.endswith("aa") else "bb")
        assert (
            anonymous.post("/api/notifications/unsubscribe", json={"token": bad}).status_code == 400
        )
    assert bob.get("/api/notifications/settings").json() == {"email": False}
    assert token == unsubscribe_token(shared["bob"], alice.app.state.settings.jwt_secret)


def test_reminders_once_per_user_per_day(alice, bob, shared):
    board = alice.get(f"/api/boards/{shared['board']}").json()
    cards = board["columns"][0]["cards"]
    today = date.today()
    alice.patch(f"/api/cards/{cards[0]['id']}", json={"due_date": str(today + timedelta(days=1))})
    alice.patch(f"/api/cards/{cards[1]['id']}", json={"due_date": str(today - timedelta(days=2))})
    for c in cards[:2]:
        alice.put(f"/api/cards/{c['id']}/assignees", json={"user_ids": [shared["bob"]]})
    before = len(mails_to(alice, "bob@example.com"))
    assert run_reminders(alice, today) == 1
    mail = mails_to(alice, "bob@example.com")[-1]
    assert len(mails_to(alice, "bob@example.com")) == before + 1
    assert cards[0]["title"] in mail.text and cards[1]["title"] in mail.text
    kinds = sorted(n["kind"] for n in notes(bob)["items"] if n["kind"] in ("due_soon", "overdue"))
    assert kinds == ["due_soon", "overdue"]
    assert run_reminders(alice, today) == 0
    assert len(mails_to(alice, "bob@example.com")) == before + 1


def test_reminders_skip_completed_cards_and_users_without_email(alice, bob, shared):
    tomorrow = date.today() + timedelta(days=1)
    alice.patch(f"/api/cards/{shared['card']}", json={"due_date": str(tomorrow), "completed": True})
    alice.put(f"/api/cards/{shared['card']}/assignees", json={"user_ids": [shared["bob"]]})
    assert run_reminders(alice) == 0


def test_reminder_email_in_arabic(alice, bob, shared):
    bob.patch("/api/auth/me", json={"language": "ar"})
    alice.patch(f"/api/cards/{shared['card']}", json={"due_date": str(date.today())})
    alice.put(f"/api/cards/{shared['card']}/assignees", json={"user_ids": [shared["bob"]]})
    run_reminders(alice, date.today())
    assert "تذكير" in mails_to(alice, "bob@example.com")[-1].subject


def test_job_runs_from_the_command_line(tmp_path):
    db = tmp_path / "cli.db"
    env = {
        **os.environ,
        "DATABASE_URL": f"sqlite:///{db}",
        "EMAIL_MODE": "console",
        "STORAGE_DIR": str(tmp_path),
    }
    r = subprocess.run(
        [sys.executable, "-m", "app.jobs", "reminders"],
        env=env,
        cwd=Path(__file__).parents[1],
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert r.returncode == 0, r.stderr
    assert "0 reminder emails" in r.stdout
