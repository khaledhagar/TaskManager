"""Public boards (T-560 to T-567, T-588; SEC-170 to SEC-172)."""

import pytest
from fastapi.testclient import TestClient
from file_helpers import PDF, png, upload
from helpers import first_board, sign_up
from sharing_helpers import join

from app import ratelimit


@pytest.fixture
def alice(client):
    sign_up(client, "alice@example.com")
    return client


@pytest.fixture
def board(alice):
    return first_board(alice)


def make_public(client, board_id, public=True):
    return client.put(f"/api/boards/{board_id}/visibility", json={"public": public})


def token_of(r) -> str:
    return r.json()["link"].rsplit("/p/", 1)[1]


def test_admin_makes_a_board_public_with_a_random_link(alice, board):
    r = make_public(alice, board["id"])
    assert r.status_code == 200
    assert r.json()["public"] is True
    assert r.json()["link"].startswith("http://app.test/p/")
    assert len(token_of(r)) >= 32
    shown = alice.get(f"/api/boards/{board['id']}").json()
    assert shown["public"] is True and shown["public_link"] == r.json()["link"]


def test_only_the_admin_changes_visibility(alice, board):
    with TestClient(alice.app) as bob:
        sign_up(bob, "bob@example.com")
        join(alice, bob, board["id"], "bob@example.com", "editor")
        assert make_public(bob, board["id"]).status_code == 403
        assert bob.get(f"/api/boards/{board['id']}").json()["public_link"] is None


def test_anyone_with_the_link_sees_a_read_only_board(alice, board):
    card = board["columns"][1]["cards"][0]
    upload(alice, card["id"], "a.pdf", PDF, "application/pdf")
    token = token_of(make_public(alice, board["id"]))
    with TestClient(alice.app) as anonymous:
        r = anonymous.get(f"/api/public/boards/{token}")
        assert r.status_code == 200
        assert r.headers["x-robots-tag"] == "noindex"
        data = r.json()
        assert data["title"] == board["title"]
        assert [c["title"] for c in data["columns"]] == [c["title"] for c in board["columns"]]
        text = r.text
        assert "alice@example.com" not in text
        assert "attachments" not in data["columns"][1]["cards"][0]
        assert "id" not in data
        for method, url in [
            ("post", f"/api/columns/{board['columns'][0]['id']}/cards"),
            ("patch", f"/api/cards/{card['id']}"),
            ("post", "/api/ai/chat"),
        ]:
            assert anonymous.request(method, url, json={"title": "x"}).status_code == 401


def test_private_again_revokes_the_link_and_public_gives_a_new_one(alice, board):
    first = token_of(make_public(alice, board["id"]))
    assert make_public(alice, board["id"], False).json() == {"public": False, "link": None}
    assert alice.get(f"/api/public/boards/{first}").status_code == 404
    second = token_of(make_public(alice, board["id"]))
    assert second != first
    assert alice.get(f"/api/public/boards/{second}").status_code == 200


def test_board_id_never_works_as_a_public_link(alice, board):
    make_public(alice, board["id"])
    assert alice.get(f"/api/public/boards/{board['id']}").status_code == 404


def test_public_background_and_404_for_private(alice, board):
    alice.put(
        f"/api/boards/{board['id']}/background",
        files={"file": ("bg.png", png((80, 60)), "image/png")},
    )
    token = token_of(make_public(alice, board["id"]))
    with TestClient(alice.app) as anonymous:
        r = anonymous.get(f"/api/public/boards/{token}/background")
        assert r.status_code == 200
        assert r.headers["content-type"] == "image/webp"
        make_public(alice, board["id"], False)
        assert anonymous.get(f"/api/public/boards/{token}/background").status_code == 404


def test_public_views_are_rate_limited_per_ip(alice, board, monkeypatch):
    monkeypatch.setattr(ratelimit, "PUBLIC_VIEWS", ratelimit.Limit(2, 60))
    token = token_of(make_public(alice, board["id"]))
    codes = [alice.get(f"/api/public/boards/{token}").status_code for _ in range(3)]
    assert codes == [200, 200, 429]


def test_signed_in_visitor_joins_as_viewer_once(alice, board):
    token = token_of(make_public(alice, board["id"]))
    with TestClient(alice.app) as bob:
        sign_up(bob, "bob@example.com")
        r = bob.post(f"/api/public/boards/{token}/join")
        assert r.status_code == 200
        assert r.json() == {**r.json(), "id": board["id"], "role": "viewer"}
        assert bob.post(f"/api/public/boards/{token}/join").json()["role"] == "viewer"
        assert len(alice.get(f"/api/boards/{board['id']}/members").json()["members"]) == 2
        assert alice.post(f"/api/public/boards/{token}/join").json()["role"] == "admin"


def test_join_needs_an_account(alice, board):
    token = token_of(make_public(alice, board["id"]))
    with TestClient(alice.app) as visitor:
        assert visitor.post(f"/api/public/boards/{token}/join").status_code == 401
        visitor.post("/api/auth/guest")
        r = visitor.post(f"/api/public/boards/{token}/join")
        assert r.status_code == 403
        assert r.json()["detail"] == "Create an account to join this board."


def test_deleting_a_public_board_kills_its_link(alice, board):
    token = token_of(make_public(alice, board["id"]))
    assert alice.delete(f"/api/boards/{board['id']}").status_code == 204
    assert alice.get(f"/api/public/boards/{token}").status_code == 404
