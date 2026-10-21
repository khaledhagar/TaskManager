"""Comments on cards and mentions (T-641 to T-646; SEC-200, SEC-201)."""

import pytest
from fastapi.testclient import TestClient
from helpers import first_board, sign_up
from sharing_helpers import join, set_role, user_id

from app.comments import mentioned_members


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
def card(alice):
    board = first_board(alice)
    return {"board": board["id"], "id": board["columns"][0]["cards"][0]["id"]}


def post(client, card_id, text):
    return client.post(f"/api/cards/{card_id}/comments", json={"text": text})


def comments(client, card_id):
    return client.get(f"/api/cards/{card_id}/comments").json()


def test_add_list_edit_delete(alice, card):
    first = post(alice, card["id"], "First **note**")
    assert first.status_code == 201
    post(alice, card["id"], "Second")
    listed = comments(alice, card["id"])
    assert [c["text"] for c in listed] == ["First **note**", "Second"]
    assert listed[0]["author_email"] == "alice@example.com"
    assert listed[0]["edited_at"] is None
    r = alice.patch(f"/api/comments/{first.json()['id']}", json={"text": "Changed"})
    assert r.status_code == 200 and r.json()["edited_at"] is not None
    assert alice.delete(f"/api/comments/{first.json()['id']}").status_code == 204
    assert [c["text"] for c in comments(alice, card["id"])] == ["Second"]


def test_viewers_read_but_cannot_write(alice, bob, card):
    member = join(alice, bob, card["board"], "bob@example.com")
    post(alice, card["id"], "Hello")
    assert len(comments(bob, card["id"])) == 1
    r = post(bob, card["id"], "Me too")
    assert r.status_code == 403
    set_role(alice, card["board"], member, "updater")
    assert post(bob, card["id"], "Me too").status_code == 201


def test_only_authors_edit_and_authors_or_admin_delete(alice, bob, card):
    join(alice, bob, card["board"], "bob@example.com", "editor")
    mine = post(alice, card["id"], "Alice").json()["id"]
    theirs = post(bob, card["id"], "Bob").json()["id"]
    assert bob.patch(f"/api/comments/{mine}", json={"text": "x"}).status_code == 403
    assert bob.delete(f"/api/comments/{mine}").status_code == 403
    assert alice.patch(f"/api/comments/{theirs}", json={"text": "x"}).status_code == 403
    assert alice.delete(f"/api/comments/{theirs}").status_code == 204
    assert bob.delete(f"/api/comments/{mine}").status_code == 403


def test_length_and_empty_text_refused(alice, card):
    assert post(alice, card["id"], "x" * 5001).status_code == 422
    assert post(alice, card["id"], "   ").status_code == 422
    assert post(alice, card["id"], "x" * 5000).status_code == 201


def test_non_members_get_404(alice, bob, card):
    comment = post(alice, card["id"], "Private").json()["id"]
    assert bob.get(f"/api/cards/{card['id']}/comments").status_code == 404
    assert post(bob, card["id"], "x").status_code == 404
    assert bob.patch(f"/api/comments/{comment}", json={"text": "x"}).status_code == 404
    assert bob.delete(f"/api/comments/{comment}").status_code == 404


def test_board_shows_comment_counts(alice, card):
    post(alice, card["id"], "One")
    post(alice, card["id"], "Two")
    board = alice.get(f"/api/boards/{card['board']}").json()
    counts = {c["id"]: c["comment_count"] for col in board["columns"] for c in col["cards"]}
    assert counts[card["id"]] == 2


def test_mentions_find_only_other_members(alice, bob, card, session):
    join(alice, bob, card["board"], "bob@example.com")
    with TestClient(alice.app) as carol:
        sign_up(carol, "carol@example.com")
    from sqlmodel import Session

    with Session(alice.app.state.engine) as s:
        found = mentioned_members(
            s,
            card["board"],
            user_id(alice),
            "Hi @bob@example.com and @carol@example.com, @alice@example.com",
        )
        assert [u.email for u in found] == ["bob@example.com"]
