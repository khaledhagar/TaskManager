"""Boards and columns API (T-040 to T-054)."""

import pytest
from helpers import column_titles, first_board, sign_up

from app import limits


@pytest.fixture
def user(client):
    sign_up(client)
    return client


def test_list_boards(user):
    boards = user.get("/api/boards").json()
    assert [b["title"] for b in boards] == ["Website Launch"]
    assert set(boards[0]) == {"id", "title", "created_at"}


def test_create_board_has_default_columns(user):
    r = user.post("/api/boards", json={"title": "Q4 Roadmap"})
    assert r.status_code == 201
    board = user.get(f"/api/boards/{r.json()['id']}").json()
    assert board["title"] == "Q4 Roadmap"
    assert column_titles(board) == ["To Do", "In Progress", "Done"]
    assert all(c["cards"] == [] for c in board["columns"])


def test_create_board_from_template(user):
    r = user.post("/api/boards", json={"template": "sprint"})
    board = user.get(f"/api/boards/{r.json()['id']}").json()
    assert board["title"] == "Sprint board"
    assert column_titles(board) == ["Backlog", "To Do", "In Progress", "Review", "Done"]
    assert board["columns"][0]["cards"]


@pytest.mark.parametrize("template", ["demo", "nope"])
def test_unknown_template_rejected(user, template):
    assert user.post("/api/boards", json={"template": template}).status_code == 422


def test_full_board_shape_and_order(user):
    board = first_board(user)
    assert {"id", "title", "columns", "labels"} <= set(board)
    assert [c["position"] for c in board["columns"]] == [0, 1, 2]
    card = board["columns"][1]["cards"][0]
    assert {
        "id",
        "title",
        "details",
        "completed",
        "priority",
        "due_date",
        "position",
        "label_ids",
        "checklist",
    } <= set(card)
    assert [i["position"] for i in card["checklist"]] == list(range(len(card["checklist"])))
    label_ids = {lbl["id"] for lbl in board["labels"]}
    assert set(card["label_ids"]) <= label_ids


def test_rename_and_delete_board(user):
    board_id = first_board(user)["id"]
    r = user.patch(f"/api/boards/{board_id}", json={"title": "Renamed"})
    assert r.json()["title"] == "Renamed"
    assert user.delete(f"/api/boards/{board_id}").status_code == 204
    assert user.get(f"/api/boards/{board_id}").status_code == 404
    assert user.get("/api/boards").json() == []


def test_board_cap(user, monkeypatch):
    monkeypatch.setattr(limits, "BOARDS_PER_USER", 2)
    assert user.post("/api/boards", json={"title": "Two"}).status_code == 201
    r = user.post("/api/boards", json={"title": "Three"})
    assert r.status_code == 400
    assert "limit" in r.json()["detail"].lower()


def test_add_column_appends(user):
    board_id = first_board(user)["id"]
    r = user.post(f"/api/boards/{board_id}/columns", json={"title": "Blocked"})
    assert r.status_code == 201
    assert r.json()["position"] == 3
    assert column_titles(first_board(user))[-1] == "Blocked"


def test_rename_column(user):
    col = first_board(user)["columns"][0]
    r = user.patch(f"/api/columns/{col['id']}", json={"title": "Backlog"})
    assert r.status_code == 200
    assert column_titles(first_board(user))[0] == "Backlog"


def test_delete_column_removes_cards_and_renumbers(user):
    board = first_board(user)
    middle = board["columns"][1]
    assert user.delete(f"/api/columns/{middle['id']}").status_code == 204
    board = first_board(user)
    assert column_titles(board) == ["To Do", "Done"]
    assert [c["position"] for c in board["columns"]] == [0, 1]
    for card in middle["cards"]:
        assert user.patch(f"/api/cards/{card['id']}", json={"title": "x"}).status_code == 404


def test_reorder_columns(user):
    board = first_board(user)
    ids = [c["id"] for c in board["columns"]]
    new = [ids[2], ids[0], ids[1]]
    r = user.post(f"/api/boards/{board['id']}/columns/order", json={"column_ids": new})
    assert r.status_code == 204
    board = first_board(user)
    assert [c["id"] for c in board["columns"]] == new
    assert [c["position"] for c in board["columns"]] == [0, 1, 2]


@pytest.mark.parametrize("bad", [[1, 2], [1, 2, 3, 3], [1, 2, 99]])
def test_reorder_requires_exact_ids(user, bad):
    board_id = first_board(user)["id"]
    r = user.post(f"/api/boards/{board_id}/columns/order", json={"column_ids": bad})
    assert r.status_code == 400


def test_column_cap(user, monkeypatch):
    monkeypatch.setattr(limits, "COLUMNS_PER_BOARD", 3)
    board_id = first_board(user)["id"]
    r = user.post(f"/api/boards/{board_id}/columns", json={"title": "Fourth"})
    assert r.status_code == 400


@pytest.mark.parametrize(
    "body", [{"title": ""}, {"title": "   "}, {"title": "x" * 201}, {"title": "ok", "extra": 1}]
)
def test_board_title_validation(user, body):
    assert user.post("/api/boards", json=body).status_code == 422
