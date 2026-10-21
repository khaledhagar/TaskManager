"""Invitation and card-change notifications; workspace members (T-739, T-741 to T-743; SEC-217)."""

from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from helpers import first_board, sign_up
from sharing_helpers import invite, join, token_of, user_id
from sqlmodel import Session, select

from app.models import Notification


@pytest.fixture
def alice(client):
    sign_up(client, "alice@example.com")
    return client


@pytest.fixture
def bob(alice):
    with TestClient(alice.app) as c:
        sign_up(c, "bob@example.com")
        yield c


def notices(client):
    return client.get("/api/notifications").json()


def changes(client):
    return [n for n in notices(client)["items"] if n["kind"] == "card_changed"]


def assigned(alice, bob):
    """Bob is a full member and assigned to the first card."""
    board = first_board(alice)
    bob_id = join(alice, bob, board["id"], "bob@example.com", "editor")
    card = board["columns"][0]["cards"][0]
    alice.put(f"/api/cards/{card['id']}/assignees", json={"user_ids": [bob_id]})
    alice.post("/api/notifications/read-all")
    bob.post("/api/notifications/read-all")
    return board, card


def test_an_invitation_shows_in_the_app_and_opens_the_invitation(alice, bob):
    board = first_board(alice)
    link = invite(alice, board["id"], "bob@example.com").json()["link"]
    data = notices(bob)
    assert data["unread"] == 1
    item = data["items"][0]
    assert item["kind"] == "invited" and item["actor_email"] == "alice@example.com"
    assert item["data"]["board"] == board["title"]
    assert item["data"]["path"] == f"/invite#token={token_of(link)}"


def test_a_resent_invitation_replaces_the_old_one_and_cancel_removes_it(alice, bob):
    board = first_board(alice)
    first = invite(alice, board["id"], "bob@example.com").json()
    invite(alice, board["id"], "bob@example.com")
    assert [n["kind"] for n in notices(bob)["items"]] == ["invited"]
    alice.delete(f"/api/invites/{first['id']}")
    assert notices(bob)["items"] == []


def test_inviting_an_unknown_address_notifies_nobody(alice, bob):
    invite(alice, first_board(alice)["id"], "carol@example.com")
    assert notices(bob)["items"] == []


def test_changes_by_others_to_your_card_notify_you(alice, bob):
    board, card = assigned(alice, bob)
    done = board["columns"][-1]["id"]
    alice.post(f"/api/cards/{card['id']}/move", json={"column_id": done, "position": 0})
    assert notices(bob)["unread"] == 1
    item = changes(bob)[0]
    assert item["card_id"] == card["id"] and item["actor_email"] == "alice@example.com"
    assert item["data"]["change"] == "card.moved" and item["data"]["title"] == card["title"]


def test_a_burst_of_changes_is_one_entry_and_your_own_changes_none(alice, bob):
    board, card = assigned(alice, bob)
    for title in ("One", "Two", "Three"):
        alice.patch(f"/api/cards/{card['id']}", json={"title": title})
    alice.post(f"/api/cards/{card['id']}/comments", json={"text": "Looks good"})
    items = changes(bob)
    assert len(items) == 1
    assert items[0]["data"]["change"] == "comment.added" and items[0]["data"]["title"] == "Three"
    bob.patch(f"/api/cards/{card['id']}", json={"completed": True})
    assert changes(alice) == []


def test_after_ten_minutes_a_new_entry_starts(alice, bob):
    board, card = assigned(alice, bob)
    alice.patch(f"/api/cards/{card['id']}", json={"title": "One"})
    with Session(alice.app.state.engine) as s:
        row = s.exec(select(Notification).where(Notification.kind == "card_changed")).one()
        row.created_at -= timedelta(minutes=11)
        s.add(row)
        s.commit()
    alice.patch(f"/api/cards/{card['id']}", json={"title": "Two"})
    assert len(changes(bob)) == 2


def test_removed_or_unassigned_people_get_nothing(alice, bob):
    board, card = assigned(alice, bob)
    alice.put(f"/api/cards/{card['id']}/assignees", json={"user_ids": []})
    alice.patch(f"/api/cards/{card['id']}", json={"title": "Changed"})
    assert changes(bob) == []
    alice.put(f"/api/cards/{card['id']}/assignees", json={"user_ids": [user_id(bob)]})
    alice.delete(f"/api/boards/{board['id']}/members/{user_id(bob)}")
    alice.patch(f"/api/cards/{card['id']}", json={"title": "Again"})
    with Session(alice.app.state.engine) as s:
        rows = s.exec(select(Notification).where(Notification.kind == "card_changed")).all()
    assert rows == []


def test_workspace_members_by_board_for_the_owner_only(alice, bob):
    made = alice.post(
        "/api/workspaces", json={"name": "Launch", "boards": [{"title": "Ops", "columns": ["A"]}]}
    ).json()
    wid, ops = made["workspace"]["id"], made["boards"][0]["id"]
    join(alice, bob, ops, "bob@example.com", "updater")
    data = alice.get(f"/api/workspaces/{wid}/members").json()
    assert data == [
        {
            "board_id": ops,
            "title": "Ops",
            "members": [
                {"email": "alice@example.com", "role": "admin"},
                {"email": "bob@example.com", "role": "updater"},
            ],
        }
    ]
    loose = alice.get("/api/workspaces/none/members").json()
    assert [b["title"] for b in loose] == [first_board(alice)["title"]]
    assert bob.get(f"/api/workspaces/{wid}/members").status_code == 404
