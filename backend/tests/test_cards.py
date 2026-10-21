"""Cards, moves, checklist items and labels (T-060 to T-074)."""

import pytest
from helpers import card_titles, first_board, sign_up

from app import limits


@pytest.fixture
def user(client):
    sign_up(client)
    return client


@pytest.fixture
def board(user):
    return first_board(user)


def add_card(user, column_id, title="New card", **extra):
    return user.post(f"/api/columns/{column_id}/cards", json={"title": title, **extra})


def test_create_card_appends_with_defaults(user, board):
    col = board["columns"][0]
    r = add_card(user, col["id"])
    assert r.status_code == 201
    card = r.json()
    assert card["position"] == len(col["cards"])
    assert card["priority"] == "medium"
    assert card["completed"] is False
    assert card["label_ids"] == [] and card["checklist"] == []


def test_update_card_fields(user, board):
    card = add_card(user, board["columns"][0]["id"]).json()
    body = {
        "title": "Updated",
        "details": "# Notes",
        "completed": True,
        "priority": "urgent",
        "due_date": "2026-12-31",
    }
    r = user.patch(f"/api/cards/{card['id']}", json=body)
    assert r.status_code == 200
    assert {k: r.json()[k] for k in body} == body
    r = user.patch(f"/api/cards/{card['id']}", json={"due_date": None})
    assert r.json()["due_date"] is None
    assert r.json()["title"] == "Updated"


@pytest.mark.parametrize(
    "body", [{"priority": "critical"}, {"due_date": "tomorrow"}, {"title": ""}, {"completed": "x"}]
)
def test_update_card_validation(user, board, body):
    card_id = board["columns"][0]["cards"][0]["id"]
    assert user.patch(f"/api/cards/{card_id}", json=body).status_code == 422


def test_delete_card_renumbers_and_removes_children(user, board):
    col = board["columns"][1]
    with_checklist = col["cards"][0]
    assert with_checklist["checklist"]
    assert user.delete(f"/api/cards/{with_checklist['id']}").status_code == 204
    col = first_board(user)["columns"][1]
    assert [c["position"] for c in col["cards"]] == list(range(len(col["cards"])))
    item_id = with_checklist["checklist"][0]["id"]
    assert user.patch(f"/api/checklist/{item_id}", json={"done": True}).status_code == 404


def move(user, card_id, column_id, position):
    return user.post(
        f"/api/cards/{card_id}/move", json={"column_id": column_id, "position": position}
    )


def test_move_within_column(user, board):
    col = board["columns"][0]
    titles = card_titles(col)
    r = move(user, col["cards"][0]["id"], col["id"], 2)
    assert r.status_code == 200
    col = first_board(user)["columns"][0]
    assert card_titles(col) == [titles[1], titles[2], titles[0]]
    assert [c["position"] for c in col["cards"]] == [0, 1, 2]


def test_move_to_other_column(user, board):
    src, dst = board["columns"][0], board["columns"][2]
    card = src["cards"][1]
    assert move(user, card["id"], dst["id"], 1).status_code == 200
    src, dst = first_board(user)["columns"][0], first_board(user)["columns"][2]
    assert card["title"] not in card_titles(src)
    assert card_titles(dst)[1] == card["title"]
    for col in (src, dst):
        assert [c["position"] for c in col["cards"]] == list(range(len(col["cards"])))


def test_move_past_end_goes_last(user, board):
    src, dst = board["columns"][0], board["columns"][1]
    card = src["cards"][0]
    move(user, card["id"], dst["id"], 999)
    assert card_titles(first_board(user)["columns"][1])[-1] == card["title"]


def test_move_negative_position_rejected(user, board):
    card = board["columns"][0]["cards"][0]
    assert move(user, card["id"], board["columns"][0]["id"], -1).status_code == 422


def test_card_cap(user, board, monkeypatch):
    assert limits.CARDS_PER_BOARD == 100
    total = sum(len(c["cards"]) for c in board["columns"])
    monkeypatch.setattr(limits, "CARDS_PER_BOARD", total)
    r = add_card(user, board["columns"][0]["id"])
    assert r.status_code == 400
    assert r.json()["detail"] == (
        f"Maximum cards in a board is {total}. Delete a card to add a new one."
    )


def test_checklist_crud(user, board):
    card_id = add_card(user, board["columns"][0]["id"]).json()["id"]
    items = [user.post(f"/api/cards/{card_id}/checklist", json={"text": t}) for t in "abc"]
    assert [r.status_code for r in items] == [201, 201, 201]
    assert [r.json()["position"] for r in items] == [0, 1, 2]
    first = items[0].json()["id"]
    r = user.patch(f"/api/checklist/{first}", json={"text": "renamed", "done": True})
    assert r.json() == {"id": first, "text": "renamed", "done": True, "position": 0}
    assert user.delete(f"/api/checklist/{first}").status_code == 204
    card = next(c for c in first_board(user)["columns"][0]["cards"] if c["id"] == card_id)
    assert [(i["text"], i["position"]) for i in card["checklist"]] == [("b", 0), ("c", 1)]


def test_checklist_cap(user, board, monkeypatch):
    monkeypatch.setattr(limits, "ITEMS_PER_CARD", 1)
    card_id = add_card(user, board["columns"][0]["id"]).json()["id"]
    assert user.post(f"/api/cards/{card_id}/checklist", json={"text": "a"}).status_code == 201
    assert user.post(f"/api/cards/{card_id}/checklist", json={"text": "b"}).status_code == 400


def test_labels_create_set_and_delete(user, board):
    r = user.post(f"/api/boards/{board['id']}/labels", json={"name": "Urgent", "color": "red"})
    assert r.status_code == 201
    label_id = r.json()["id"]
    card_id = board["columns"][0]["cards"][0]["id"]
    r = user.put(f"/api/cards/{card_id}/labels", json={"label_ids": [label_id]})
    assert r.json()["label_ids"] == [label_id]
    assert user.delete(f"/api/labels/{label_id}").status_code == 204
    card = first_board(user)["columns"][0]["cards"][0]
    assert label_id not in card["label_ids"]
    assert label_id not in [lbl["id"] for lbl in first_board(user)["labels"]]


def test_set_labels_replaces(user, board):
    card = board["columns"][0]["cards"][2]
    assert len(card["label_ids"]) == 2
    r = user.put(f"/api/cards/{card['id']}/labels", json={"label_ids": card["label_ids"][:1]})
    assert r.json()["label_ids"] == card["label_ids"][:1]
    r = user.put(f"/api/cards/{card['id']}/labels", json={"label_ids": []})
    assert r.json()["label_ids"] == []


@pytest.mark.parametrize("body", [{"name": "x", "color": "pink"}, {"name": "", "color": "red"}])
def test_label_validation(user, board, body):
    assert user.post(f"/api/boards/{board['id']}/labels", json=body).status_code == 422
