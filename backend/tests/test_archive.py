"""Archive, restore and duplicate cards and boards (T-680 to T-683; SEC-207)."""

import pytest
from file_helpers import png, storage, upload
from helpers import card_titles, first_board, sign_up

from app import limits


@pytest.fixture
def alice(client):
    sign_up(client, "alice@example.com")
    return client


@pytest.fixture
def board(alice):
    return first_board(alice)


def get(client, board_id):
    return client.get(f"/api/boards/{board_id}").json()


def test_archived_card_leaves_the_board_and_comes_back_at_the_end(alice, board):
    column = board["columns"][0]
    card = column["cards"][0]
    assert alice.post(f"/api/cards/{card['id']}/archive").status_code == 204
    after = get(alice, board["id"])["columns"][0]
    assert card["title"] not in card_titles(after)
    assert [c["position"] for c in after["cards"]] == list(range(len(after["cards"])))
    archived = alice.get(f"/api/boards/{board['id']}/archived").json()
    assert archived[0]["id"] == card["id"] and archived[0]["column_title"] == column["title"]

    r = alice.post(f"/api/cards/{card['id']}/restore")
    assert r.status_code == 200 and r.json()["position"] == len(after["cards"])
    assert card_titles(get(alice, board["id"])["columns"][0])[-1] == card["title"]
    assert alice.get(f"/api/boards/{board['id']}/archived").json() == []


def test_archived_cards_do_not_count_toward_the_card_limit(alice, board, monkeypatch):
    total = sum(len(c["cards"]) for c in board["columns"])
    monkeypatch.setattr(limits, "CARDS_PER_BOARD", total)
    column_id = board["columns"][0]["id"]
    assert alice.post(f"/api/columns/{column_id}/cards", json={"title": "x"}).status_code == 400
    card_id = board["columns"][0]["cards"][0]["id"]
    alice.post(f"/api/cards/{card_id}/archive")
    assert alice.post(f"/api/columns/{column_id}/cards", json={"title": "x"}).status_code == 201
    assert alice.post(f"/api/cards/{card_id}/restore").status_code == 400


def test_an_archived_card_can_be_deleted(alice, board):
    card_id = board["columns"][0]["cards"][0]["id"]
    alice.post(f"/api/cards/{card_id}/archive")
    assert alice.delete(f"/api/cards/{card_id}").status_code == 204
    assert alice.get(f"/api/boards/{board['id']}/archived").json() == []


def test_deleting_a_column_removes_the_files_of_its_archived_cards(alice, board):
    card_id = board["columns"][0]["cards"][0]["id"]
    upload(alice, card_id, "a.png", png(), "image/png")
    alice.post(f"/api/cards/{card_id}/archive")
    alice.delete(f"/api/columns/{board['columns'][0]['id']}")
    assert list(storage(alice).root.iterdir()) == []


def test_archive_and_restore_a_board(alice, board):
    r = alice.post(f"/api/boards/{board['id']}/archive")
    assert r.status_code == 200 and r.json()["archived"] is True
    listed = alice.get("/api/boards").json()
    assert [b["archived"] for b in listed if b["id"] == board["id"]] == [True]
    assert get(alice, board["id"])["archived"] is True
    assert alice.post(f"/api/boards/{board['id']}/restore").json()["archived"] is False


def test_duplicate_card_copies_content_only(alice, board):
    card = board["columns"][1]["cards"][0]
    alice.post(f"/api/cards/{card['id']}/comments", json={"text": "hi"})
    upload(alice, card["id"], "a.png", png(), "image/png")
    r = alice.post(f"/api/cards/{card['id']}/duplicate")
    assert r.status_code == 201
    copy = r.json()
    assert copy["title"] == f"{card['title']} (copy)"
    assert copy["position"] == card["position"] + 1
    for field in ("details", "priority", "due_date", "label_ids", "completed"):
        assert copy[field] == card[field]
    assert [i["text"] for i in copy["checklist"]] == [i["text"] for i in card["checklist"]]
    assert copy["attachments"] == [] and copy["assignee_ids"] == []
    assert alice.get(f"/api/cards/{copy['id']}/comments").json() == []


def test_duplicate_card_respects_the_card_limit(alice, board, monkeypatch):
    monkeypatch.setattr(limits, "CARDS_PER_BOARD", sum(len(c["cards"]) for c in board["columns"]))
    card_id = board["columns"][0]["cards"][0]["id"]
    assert alice.post(f"/api/cards/{card_id}/duplicate").status_code == 400


def test_duplicate_board_copies_columns_cards_labels_and_checklists(alice, board):
    r = alice.post(f"/api/boards/{board['id']}/duplicate")
    assert r.status_code == 201
    copy = get(alice, r.json()["id"])
    assert copy["title"] == f"{board['title']} (copy)"
    assert [c["title"] for c in copy["columns"]] == [c["title"] for c in board["columns"]]
    assert [card_titles(c) for c in copy["columns"]] == [card_titles(c) for c in board["columns"]]
    assert [lbl["name"] for lbl in copy["labels"]] == [lbl["name"] for lbl in board["labels"]]
    first, original = copy["columns"][1]["cards"][0], board["columns"][1]["cards"][0]
    assert first["due_date"] == original["due_date"]
    assert len(first["label_ids"]) == len(original["label_ids"])
    assert [m["email"] for m in copy["members"]] == ["alice@example.com"]


def test_duplicate_board_respects_the_board_limit(alice, board, monkeypatch):
    monkeypatch.setattr(limits, "BOARDS_PER_USER", 1)
    assert alice.post(f"/api/boards/{board['id']}/duplicate").status_code == 400


def test_archived_column_leaves_the_board_with_its_cards_and_comes_back_last(alice, board):
    """T-754: archive a whole column; restore puts it back at the end."""
    first = board["columns"][0]
    assert alice.post(f"/api/columns/{first['id']}/archive").status_code == 204
    after = get(alice, board["id"])
    assert first["title"] not in [c["title"] for c in after["columns"]]
    assert [c["position"] for c in after["columns"]] == list(range(len(after["columns"])))
    listed = alice.get(f"/api/boards/{board['id']}/archived-columns").json()
    assert listed[0]["id"] == first["id"] and listed[0]["cards"] == len(first["cards"])
    r = alice.post(f"/api/columns/{first['id']}/restore")
    assert r.status_code == 200 and r.json()["position"] == len(after["columns"])
    back = get(alice, board["id"])["columns"][-1]
    assert back["title"] == first["title"] and len(back["cards"]) == len(first["cards"])
    assert alice.get(f"/api/boards/{board['id']}/archived-columns").json() == []


def test_cards_in_an_archived_column_do_not_count(alice, board, monkeypatch):
    total = sum(len(c["cards"]) for c in board["columns"])
    monkeypatch.setattr(limits, "CARDS_PER_BOARD", total)
    first, second = board["columns"][0], board["columns"][1]
    alice.post(f"/api/columns/{first['id']}/archive")
    r = alice.post(f"/api/columns/{second['id']}/cards", json={"title": "x"})
    assert r.status_code == 201
    assert alice.post(f"/api/columns/{first['id']}/restore").status_code == 400


def test_restoring_a_column_respects_the_column_limit(alice, board, monkeypatch):
    first = board["columns"][0]
    alice.post(f"/api/columns/{first['id']}/archive")
    monkeypatch.setattr(limits, "COLUMNS_PER_BOARD", len(board["columns"]) - 1)
    assert alice.post(f"/api/columns/{first['id']}/restore").status_code == 400


def test_deleting_a_board_removes_files_in_archived_columns(alice, board):
    card_id = board["columns"][0]["cards"][0]["id"]
    upload(alice, card_id, "a.png", png(), "image/png")
    alice.post(f"/api/columns/{board['columns'][0]['id']}/archive")
    alice.delete(f"/api/boards/{board['id']}")
    assert list(storage(alice).root.iterdir()) == []
