"""Invites (T-516 to T-522, T-530, T-531, T-536)."""

import hashlib
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from helpers import first_board, outbox, sign_up
from sharing_helpers import accept, invite, join, token_of
from sqlmodel import Session, select

from app import limits, ratelimit
from app.models import BoardInvite


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
def board_id(alice):
    return first_board(alice)["id"]


def members(client, board_id):
    return client.get(f"/api/boards/{board_id}/members").json()


# --- invites ---------------------------------------------------------------------


def test_invite_emails_a_link_and_stores_only_its_hash(alice, board_id):
    r = invite(alice, board_id, "Bob@Example.com")
    assert r.status_code == 201
    body = r.json()
    assert body["email"] == "bob@example.com"
    assert body["link"].startswith("http://app.test/invite#token=")
    mail = outbox(alice)[-1]
    assert mail.to == "bob@example.com"
    assert body["link"] in mail.text
    assert "alice@example.com" in mail.text
    token = token_of(body["link"])
    with Session(alice.app.state.engine) as s:
        row = s.exec(select(BoardInvite)).one()
    assert row.token_hash == hashlib.sha256(token.encode()).hexdigest()
    assert token not in row.token_hash


def test_invite_does_not_reveal_whether_the_address_has_an_account(alice, board_id):
    with TestClient(alice.app) as carol:
        sign_up(carol, "carol@example.com")
    a = invite(alice, board_id, "nobody@example.com")
    b = invite(alice, board_id, "carol@example.com")
    assert (a.status_code, a.json().keys()) == (b.status_code, b.json().keys())
    texts = [m.text.split("#token=")[0] for m in outbox(alice)[-2:]]
    assert texts[0].replace("nobody", "X") == texts[1].replace("carol", "X")


def test_preview_shows_board_and_inviter_without_sign_in(alice, board_id):
    token = token_of(invite(alice, board_id, "bob@example.com").json()["link"])
    with TestClient(alice.app) as anonymous:
        r = anonymous.post("/api/invites/preview", json={"token": token})
    assert r.status_code == 200
    assert r.json() == {
        "board_title": first_board(alice)["title"],
        "invited_by": "alice@example.com",
        "email": "bob@example.com",
    }


def test_accept_adds_a_viewer_and_the_link_works_once(alice, bob, board_id):
    token = token_of(invite(alice, board_id, "bob@example.com").json()["link"])
    r = accept(bob, token)
    assert r.status_code == 200
    assert r.json()["id"] == board_id
    assert r.json()["role"] == "viewer"
    assert accept(bob, token).status_code == 400
    assert bob.post("/api/invites/preview", json={"token": token}).status_code == 400


def test_invite_expires_after_7_days(alice, bob, board_id):
    token = token_of(invite(alice, board_id, "bob@example.com").json()["link"])
    with Session(alice.app.state.engine) as s:
        row = s.exec(select(BoardInvite)).one()
        assert row.expires_at.replace(tzinfo=UTC) - datetime.now(UTC) > timedelta(days=6, hours=23)
        row.expires_at = datetime.now(UTC) - timedelta(minutes=1)
        s.add(row)
        s.commit()
    r = accept(bob, token)
    assert r.status_code == 400
    assert r.json()["detail"] == "This invitation link is invalid or has expired."


def test_accept_needs_the_invited_email(alice, bob, board_id):
    token = token_of(invite(alice, board_id, "carol@example.com").json()["link"])
    r = accept(bob, token)
    assert r.status_code == 403
    assert "carol@example.com" in r.json()["detail"]
    with TestClient(alice.app) as carol:
        sign_up(carol, "carol@example.com")
        assert accept(carol, token).status_code == 200


def test_accept_needs_sign_in(alice, board_id):
    token = token_of(invite(alice, board_id, "bob@example.com").json()["link"])
    with TestClient(alice.app) as anonymous:
        assert accept(anonymous, token).status_code == 401


def test_inviting_a_member_again_is_refused(alice, bob, board_id):
    join(alice, bob, board_id, "bob@example.com")
    r = invite(alice, board_id, "bob@example.com")
    assert r.status_code == 400
    assert invite(alice, board_id, "alice@example.com").status_code == 400


def test_cancel_and_resend_invite(alice, bob, board_id):
    first = invite(alice, board_id, "bob@example.com").json()
    resent = alice.post(f"/api/invites/{first['id']}/resend")
    assert resent.status_code == 200
    assert accept(bob, token_of(first["link"])).status_code == 400
    assert alice.delete(f"/api/invites/{first['id']}").status_code == 204
    assert accept(bob, token_of(resent.json()["link"])).status_code == 400
    assert bob.delete(f"/api/invites/{first['id']}").status_code == 404


def test_guests_cannot_invite_or_accept(alice, board_id):
    token = token_of(invite(alice, board_id, "bob@example.com").json()["link"])
    with TestClient(alice.app) as guest:
        guest.post("/api/auth/guest")
        own = first_board(guest)["id"]
        r = invite(guest, own, "x@example.com")
        assert r.status_code == 403
        assert r.json()["detail"] == "Create an account to share this board."
        assert accept(guest, token).status_code == 403


def test_member_and_invite_limits(alice, board_id, monkeypatch):
    monkeypatch.setattr(limits, "INVITES_PER_BOARD", 2)
    assert invite(alice, board_id, "a@example.com").status_code == 201
    assert invite(alice, board_id, "b@example.com").status_code == 201
    assert invite(alice, board_id, "c@example.com").status_code == 400
    monkeypatch.setattr(limits, "MEMBERS_PER_BOARD", 1)
    alice.delete(f"/api/invites/{members(alice, board_id)['invites'][0]['id']}")
    assert invite(alice, board_id, "d@example.com").status_code == 400


def test_invite_rate_limit(alice, board_id, monkeypatch):
    monkeypatch.setattr(ratelimit, "INVITES", ratelimit.Limit(2, 3600))
    monkeypatch.setattr(limits, "INVITES_PER_BOARD", 100)
    assert invite(alice, board_id, "a@example.com").status_code == 201
    assert invite(alice, board_id, "b@example.com").status_code == 201
    assert invite(alice, board_id, "c@example.com").status_code == 429


def test_invite_email_in_arabic(alice, board_id):
    alice.post(
        f"/api/boards/{board_id}/invites",
        json={"email": "bob@example.com"},
        headers={"Accept-Language": "ar"},
    )
    assert "دعاك" in outbox(alice)[-1].text
