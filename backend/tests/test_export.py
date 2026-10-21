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


def rows(response) -> list[dict]:
    text = response.content.decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(text)))


def test_csv_has_every_card(alice, board):
    r = alice.get(f"/api/boards/{board['id']}/export.csv")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    disposition = r.headers["content-disposition"]
    assert disposition.startswith(f'attachment; filename="board-{board["id"]}.csv"')
    assert disposition.endswith("filename*=UTF-8''Website%20Launch.csv")
    assert r.content.startswith(b"\xef\xbb\xbf")
    found = rows(r)
    titles = [c["title"] for col in board["columns"] for c in col["cards"]]
    assert [row["Title"] for row in found] == titles
    first = board["columns"][1]["cards"][0]
    row = found[[r["Title"] for r in found].index(first["title"])]
    assert row["Column"] == board["columns"][1]["title"]
    assert row["Priority"] == first["priority"]
    assert row["Due date"] == (first["due_date"] or "")
    done = sum(i["done"] for i in first["checklist"])
    assert row["Checklist"] == f"{done}/{len(first['checklist'])}"


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
    assert "'=HYPERLINK(1)" in [r["Title"] for r in found]


def test_archived_cards_are_left_out(alice, board):
    card = board["columns"][0]["cards"][0]
    alice.post(f"/api/cards/{card['id']}/archive")
    found = rows(alice.get(f"/api/boards/{board['id']}/export.csv"))
    assert card["title"] not in [r["Title"] for r in found]


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
