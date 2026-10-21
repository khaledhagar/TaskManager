"""Board export as CSV and JSON (T-706 to T-708; SEC-208)."""

import csv
import io

import pytest
from fastapi.testclient import TestClient
from helpers import first_board, sign_up
from sharing_helpers import join

from app.export import safe_cell


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


def rows(response) -> list[list[str]]:
    return list(csv.reader(io.StringIO(response.content.decode("utf-8-sig"))))


def column_cells(found: list[list[str]], index: int) -> list[tuple[str, str]]:
    """(task, status) pairs under board column `index`, skipping empty cells."""
    pairs = [(r[2 * index], r[2 * index + 1]) for r in found[1:]]
    return [p for p in pairs if p != ("", "")]


def test_csv_has_each_board_column_with_its_tasks_and_status(alice, board):
    """T-766: the user's layout: column name, its tasks below, then a Status column."""
    r = alice.get(f"/api/boards/{board['id']}/export.csv")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    disposition = r.headers["content-disposition"]
    assert disposition.startswith(f'attachment; filename="board-{board["id"]}.csv"')
    assert disposition.endswith("filename*=UTF-8''Website%20Launch.csv")
    assert r.content.startswith(b"\xef\xbb\xbf")
    found = rows(r)
    header = []
    for col in board["columns"]:
        header += [col["title"], "Status"]
    assert found[0] == header
    tallest = max(len(c["cards"]) for c in board["columns"])
    assert len(found) == 1 + tallest
    for i, col in enumerate(board["columns"]):
        expected = [(c["title"], "Completed" if c["completed"] else "Open") for c in col["cards"]]
        assert column_cells(found, i) == expected


def test_csv_status_words_follow_the_language(alice, board):
    found = rows(
        alice.get(f"/api/boards/{board['id']}/export.csv", headers={"Accept-Language": "ar"})
    )
    assert found[0][1] == "الحالة"
    assert {cell for row in found[1:] for cell in row[1::2] if cell} <= {"منجزة", "مفتوحة"}


@pytest.mark.parametrize("text", ["=1+1", "+cmd", "-2", "@SUM(A1)", "\t=x", "\r=x"])
def test_formula_cells_are_escaped(text):
    assert safe_cell(text) == "'" + text


def test_plain_cells_are_unchanged():
    assert safe_cell("Fix bug") == "Fix bug"
    assert safe_cell("") == ""


def test_a_formula_title_is_escaped_in_the_file(alice, board):
    column_id = board["columns"][0]["id"]
    alice.post(f"/api/columns/{column_id}/cards", json={"title": "=HYPERLINK(1)"})
    found = rows(alice.get(f"/api/boards/{board['id']}/export.csv"))
    assert "'=HYPERLINK(1)" in [task for task, _ in column_cells(found, 0)]


def test_archived_cards_are_left_out(alice, board):
    card = board["columns"][0]["cards"][0]
    alice.post(f"/api/cards/{card['id']}/archive")
    found = rows(alice.get(f"/api/boards/{board['id']}/export.csv"))
    assert card["title"] not in [task for task, _ in column_cells(found, 0)]


def test_json_has_the_board_and_member_emails_only(alice, bob, board):
    join(alice, bob, board["id"], "bob@example.com")
    r = alice.get(f"/api/boards/{board['id']}/export.json")
    assert r.status_code == 200
    assert "attachment" in r.headers["content-disposition"]
    data = r.json()
    assert data["title"] == board["title"]
    assert data["members"] == ["alice@example.com", "bob@example.com"]
    assert [c["title"] for c in data["columns"]] == [c["title"] for c in board["columns"]]
    card = data["columns"][1]["cards"][0]
    assert set(card) == {
        "title",
        "details",
        "priority",
        "due_date",
        "completed",
        "labels",
        "assignees",
        "checklist",
    }
    assert set(data) == {"title", "members", "labels", "columns"}
    assert set(data["columns"][0]) == {"title", "cards"}
    assert set(data["labels"][0]) == {"name", "color"}


def test_export_is_for_members_only(alice, bob, board):
    for kind in ("csv", "json"):
        assert bob.get(f"/api/boards/{board['id']}/export.{kind}").status_code == 404
    join(alice, bob, board["id"], "bob@example.com")
    for kind in ("csv", "json"):
        assert bob.get(f"/api/boards/{board['id']}/export.{kind}").status_code == 200
