"""Card assignees and the meeting link (T-568 to T-573; SEC-164, SEC-166, SEC-168, SEC-173)."""

import pytest
from fastapi.testclient import TestClient
from helpers import first_board, outbox, sign_up
from sharing_helpers import join, set_role, user_id

from app import ratelimit


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
def board(alice):
    return first_board(alice)


def assign(client, card_id, user_ids):
    return client.put(f"/api/cards/{card_id}/assignees", json={"user_ids": user_ids})


def card_of(client, board_id, card_id):
    shown = client.get(f"/api/boards/{board_id}").json()
    return next(c for col in shown["columns"] for c in col["cards"] if c["id"] == card_id)


# --- assignees -------------------------------------------------------------------


def test_admin_and_full_access_assign_members(alice, bob, board):
    bob_id = join(alice, bob, board["id"], "bob@example.com")
    card = board["columns"][0]["cards"][0]
    r = assign(alice, card["id"], [bob_id, user_id(alice)])
    assert r.status_code == 200
    assert r.json()["assignee_ids"] == sorted([bob_id, user_id(alice)])
    assert assign(bob, card["id"], [bob_id]).status_code == 403
    set_role(alice, board["id"], bob_id, "updater")
    assert assign(bob, card["id"], [bob_id]).status_code == 403
    set_role(alice, board["id"], bob_id, "editor")
    assert assign(bob, card["id"], []).status_code == 200
    assert card_of(alice, board["id"], card["id"])["assignee_ids"] == []


def test_only_members_can_be_assigned(alice, bob, board):
    card = board["columns"][0]["cards"][0]
    assert assign(alice, card["id"], [user_id(bob)]).status_code == 404
    assert assign(alice, card["id"], [999]).status_code == 404


def test_board_lists_members_for_assignment(alice, bob, board):
    join(alice, bob, board["id"], "bob@example.com")
    shown = bob.get(f"/api/boards/{board['id']}").json()
    assert [m["email"] for m in shown["members"]] == ["alice@example.com", "bob@example.com"]


def test_removing_a_member_removes_their_assignments(alice, bob, board):
    bob_id = join(alice, bob, board["id"], "bob@example.com")
    card = board["columns"][0]["cards"][0]
    assign(alice, card["id"], [bob_id])
    alice.delete(f"/api/boards/{board['id']}/members/{bob_id}")
    assert card_of(alice, board["id"], card["id"])["assignee_ids"] == []


# --- meeting link ----------------------------------------------------------------

ZOOM = "https://us05web.zoom.us/j/123456789?pwd=abc"


def set_meeting(client, board_id, url):
    return client.put(f"/api/boards/{board_id}/meeting", json={"url": url})


def test_admin_saves_and_removes_the_meeting_link(alice, bob, board):
    join(alice, bob, board["id"], "bob@example.com", "editor")
    assert set_meeting(alice, board["id"], ZOOM).json() == {"url": ZOOM}
    assert bob.get(f"/api/boards/{board['id']}").json()["meeting_url"] == ZOOM
    assert set_meeting(bob, board["id"], ZOOM).status_code == 403
    assert set_meeting(alice, board["id"], None).json() == {"url": None}
    assert alice.get(f"/api/boards/{board['id']}").json()["meeting_url"] is None


@pytest.mark.parametrize(
    "url",
    [
        "javascript:alert(1)",
        "http://zoom.us/j/1",
        "https://",
        "ftp://x.com",
        "https://x.com/" + "a" * 500,
    ],
)
def test_meeting_link_must_be_https(alice, board, url):
    assert set_meeting(alice, board["id"], url).status_code == 422


def test_email_the_link_to_members(alice, bob, board):
    join(alice, bob, board["id"], "bob@example.com")
    with TestClient(alice.app) as carol:
        sign_up(carol, "carol@example.com")
        join(alice, carol, board["id"], "carol@example.com")
    url = f"/api/boards/{board['id']}/meeting/email"
    assert alice.post(url).status_code == 400
    set_meeting(alice, board["id"], ZOOM)
    sent = len(outbox(alice))
    assert alice.post(url).json() == {"sent": 2}
    mails = outbox(alice)[sent:]
    assert sorted(m.to for m in mails) == ["bob@example.com", "carol@example.com"]
    assert all(ZOOM in m.text and board["title"] in m.text for m in mails)
    assert bob.post(url).status_code == 403


def test_sending_the_link_notifies_each_member(alice, bob, board):
    """T-803: members also get a notification that opens the board; the admin gets none."""
    join(alice, bob, board["id"], "bob@example.com")
    set_meeting(alice, board["id"], ZOOM)
    alice.post(f"/api/boards/{board['id']}/meeting/email")
    meetings = [n for n in bob.get("/api/notifications").json()["items"] if n["kind"] == "meeting"]
    assert len(meetings) == 1
    assert meetings[0]["board_id"] == board["id"]
    assert meetings[0]["actor_email"] == "alice@example.com"
    assert meetings[0]["data"] == {"board": board["title"]}
    mine = alice.get("/api/notifications").json()["items"]
    assert not [n for n in mine if n["kind"] == "meeting"]


def test_meeting_email_in_arabic_and_rate_limited(alice, bob, board, monkeypatch):
    monkeypatch.setattr(ratelimit, "MEETING_EMAILS", ratelimit.Limit(1, 3600))
    join(alice, bob, board["id"], "bob@example.com")
    set_meeting(alice, board["id"], ZOOM)
    url = f"/api/boards/{board['id']}/meeting/email"
    assert alice.post(url, headers={"Accept-Language": "ar"}).status_code == 200
    assert "اجتماع" in outbox(alice)[-1].subject
    assert alice.post(url).status_code == 429
