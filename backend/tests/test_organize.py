"""Templates, stars, WIP limits, auto-complete, covers and focus sessions (T-684 to T-688,
T-696, T-697; SEC-207, SEC-214)."""

import pytest
from fastapi.testclient import TestClient
from file_helpers import PDF, png, upload
from helpers import card_titles, first_board, sign_up

from app import organize


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


def get(client, board_id):
    return client.get(f"/api/boards/{board_id}").json()


def test_save_a_board_as_template_and_create_from_it(alice, board):
    r = alice.post("/api/templates", json={"board_id": board["id"], "name": "Launch plan"})
    assert r.status_code == 201
    template = r.json()
    assert alice.get("/api/templates").json() == [template]
    new = alice.post("/api/boards", json={"template_id": template["id"]}).json()
    made = get(alice, new["id"])
    assert made["title"] == "Launch plan"
    assert [card_titles(c) for c in made["columns"]] == [card_titles(c) for c in board["columns"]]
    assert all(c["due_date"] is None for col in made["columns"] for c in col["cards"])
    assert alice.delete(f"/api/templates/{template['id']}").status_code == 204
    assert alice.get("/api/templates").json() == []


def test_templates_are_private(alice, bob, board):
    template = alice.post("/api/templates", json={"board_id": board["id"], "name": "Mine"}).json()
    assert bob.get("/api/templates").json() == []
    assert bob.post("/api/boards", json={"template_id": template["id"]}).status_code == 404
    assert bob.delete(f"/api/templates/{template['id']}").status_code == 404
    body = {"board_id": board["id"], "name": "x"}
    assert bob.post("/api/templates", json=body).status_code == 404


def test_at_most_twenty_templates(alice, board, monkeypatch):
    monkeypatch.setattr(organize, "TEMPLATES_PER_USER", 1)
    body = {"board_id": board["id"], "name": "One"}
    assert alice.post("/api/templates", json=body).status_code == 201
    assert alice.post("/api/templates", json=body).status_code == 400


def test_star_and_unstar(alice, board):
    assert alice.get("/api/boards").json()[0]["starred"] is False
    assert alice.put(f"/api/boards/{board['id']}/star").status_code == 204
    assert alice.put(f"/api/boards/{board['id']}/star").status_code == 204
    assert alice.get("/api/boards").json()[0]["starred"] is True
    assert alice.delete(f"/api/boards/{board['id']}/star").status_code == 204
    assert alice.get("/api/boards").json()[0]["starred"] is False


def test_wip_limit_is_set_cleared_and_checked(alice, board):
    url = f"/api/columns/{board['columns'][0]['id']}"
    r = alice.patch(url, json={"wip_limit": 2})
    assert r.status_code == 200 and r.json()["wip_limit"] == 2
    assert get(alice, board["id"])["columns"][0]["wip_limit"] == 2
    assert alice.patch(url, json={"title": "Next"}).json()["wip_limit"] == 2
    assert alice.patch(url, json={"wip_limit": None}).json()["wip_limit"] is None
    for bad in (0, 101):
        assert alice.patch(url, json={"wip_limit": bad}).status_code == 422


def test_auto_complete_on_the_last_column(alice, board):
    r = alice.patch(f"/api/boards/{board['id']}", json={"auto_complete": True})
    assert r.status_code == 200
    assert get(alice, board["id"])["auto_complete"] is True
    first, last = board["columns"][0], board["columns"][-1]
    url = f"/api/cards/{first['cards'][0]['id']}/move"
    moved = alice.post(url, json={"column_id": last["id"], "position": 0})
    assert moved.json()["completed"] is True
    back = alice.post(url, json={"column_id": first["id"], "position": 0})
    assert back.json()["completed"] is False


def test_moves_change_nothing_without_auto_complete(alice, board):
    card = board["columns"][0]["cards"][0]
    last = board["columns"][-1]["id"]
    moved = alice.post(f"/api/cards/{card['id']}/move", json={"column_id": last, "position": 0})
    assert moved.json()["completed"] is False


def test_cover_must_be_an_image_of_the_same_card(alice, board):
    card, other = board["columns"][0]["cards"][:2]
    image = upload(alice, card["id"], "a.png", png(), "image/png").json()["id"]
    pdf = upload(alice, card["id"], "a.pdf", PDF, "application/pdf").json()["id"]
    foreign = upload(alice, other["id"], "b.png", png(), "image/png").json()["id"]
    url = f"/api/cards/{card['id']}/cover"
    assert alice.put(url, json={"attachment_id": pdf}).status_code == 400
    assert alice.put(url, json={"attachment_id": foreign}).status_code == 404
    r = alice.put(url, json={"attachment_id": image})
    assert r.status_code == 200 and r.json()["cover_attachment_id"] == image
    alice.delete(f"/api/attachments/{image}")
    assert get(alice, board["id"])["columns"][0]["cards"][0]["cover_attachment_id"] is None


def test_focus_sessions_are_saved_and_shown(alice, board):
    card_id = board["columns"][0]["cards"][0]["id"]
    url = f"/api/cards/{card_id}/focus-sessions"
    assert alice.post(url, json={"minutes": 25}).status_code == 201
    r = alice.post(url, json={"minutes": 50})
    assert r.json() == {"focus_count": 2, "focus_minutes": 75}
    shown = get(alice, board["id"])["columns"][0]["cards"][0]
    assert (shown["focus_count"], shown["focus_minutes"]) == (2, 75)


def test_focus_minutes_are_limited_and_need_access(alice, bob, board):
    url = f"/api/cards/{board['columns'][0]['cards'][0]['id']}/focus-sessions"
    for bad in (0, 61):
        assert alice.post(url, json={"minutes": bad}).status_code == 422
    assert alice.post(url, json={"minutes": 25, "user_id": 2}).status_code == 422
    assert bob.post(url, json={"minutes": 25}).status_code == 404
