"""Activity log (T-647 to T-649; SEC-205)."""

import pytest
from fastapi.testclient import TestClient
from file_helpers import PDF, png, upload
from helpers import first_board, sign_up
from sharing_helpers import join
from sqlmodel import Session, func, select

from app import activity as activity_module
from app.models import Activity


@pytest.fixture
def alice(client):
    sign_up(client, "alice@example.com")
    return client


@pytest.fixture
def ids(alice):
    board = first_board(alice)
    card = board["columns"][1]["cards"][0]
    attachment = upload(alice, card["id"], "a.pdf", PDF, "application/pdf").json()["id"]
    return {
        "board": board["id"],
        "column": board["columns"][0]["id"],
        "card": card["id"],
        "item": card["checklist"][0]["id"],
        "label": board["labels"][0]["id"],
        "attachment": attachment,
        "columns": [c["id"] for c in board["columns"]],
    }


def changes(i):
    b, col, card = i["board"], i["column"], i["card"]
    return [
        ("patch", f"/api/boards/{b}", {"title": "Renamed"}),
        ("post", f"/api/boards/{b}/columns", {"title": "New"}),
        ("post", f"/api/boards/{b}/columns/order", {"column_ids": list(reversed(i["columns"]))}),
        ("patch", f"/api/columns/{col}", {"title": "Renamed column"}),
        ("post", f"/api/boards/{b}/labels", {"name": "New", "color": "red"}),
        ("delete", f"/api/labels/{i['label']}", None),
        ("post", f"/api/columns/{col}/cards", {"title": "New card"}),
        ("patch", f"/api/cards/{card}", {"title": "Renamed card"}),
        ("patch", f"/api/cards/{card}", {"completed": True}),
        ("patch", f"/api/cards/{card}", {"details": "Secret text"}),
        ("post", f"/api/cards/{card}/move", {"column_id": col, "position": 0}),
        ("put", f"/api/cards/{card}/labels", {"label_ids": []}),
        ("put", f"/api/cards/{card}/assignees", {"user_ids": []}),
        ("post", f"/api/cards/{card}/checklist", {"text": "Step"}),
        ("patch", f"/api/checklist/{i['item']}", {"done": True}),
        ("delete", f"/api/checklist/{i['item']}", None),
        ("post", f"/api/cards/{card}/comments", {"text": "Note"}),
        ("delete", f"/api/attachments/{i['attachment']}", None),
        ("put", f"/api/boards/{b}/background/preset", {"preset": "dusk"}),
        ("delete", f"/api/boards/{b}/background", None),
        ("put", f"/api/boards/{b}/visibility", {"public": True}),
        ("put", f"/api/boards/{b}/meeting", {"url": "https://zoom.us/j/1"}),
        ("post", f"/api/boards/{b}/invites", {"email": "carol@example.com"}),
        ("delete", f"/api/cards/{card}", None),
        ("delete", f"/api/columns/{col}", None),
    ]


def count(client, board_id) -> int:
    with Session(client.app.state.engine) as s:
        return s.exec(select(func.count()).where(Activity.board_id == board_id)).one()


CASES = [
    f"{m} {u}"
    for m, u, _ in changes(
        dict.fromkeys(["board", "column", "card", "item", "label", "attachment"], 0)
        | {"columns": []}
    )
]


@pytest.mark.parametrize("index", range(len(CASES)), ids=CASES)
def test_every_change_writes_one_entry(index, alice, ids):
    method, url, body = changes(ids)[index]
    before = count(alice, ids["board"])
    r = alice.request(method, url, json=body)
    assert r.status_code < 300, (method, url, r.status_code, r.text)
    assert count(alice, ids["board"]) == before + 1, (method, url)


def test_uploads_and_members_are_logged(alice, ids):
    before = count(alice, ids["board"])
    upload(alice, ids["card"], "b.pdf", PDF, "application/pdf")
    alice.put(
        f"/api/boards/{ids['board']}/background",
        files={"file": ("bg.png", png((80, 60)), "image/png")},
    )
    with TestClient(alice.app) as bob:
        sign_up(bob, "bob@example.com")
        member = join(alice, bob, ids["board"], "bob@example.com", "editor")
        bob.delete(f"/api/boards/{ids['board']}/members/{member}")
    kinds = [a["kind"] for a in alice.get(f"/api/boards/{ids['board']}/activity").json()]
    assert {
        "attachment.added",
        "background.changed",
        "invite.sent",
        "member.joined",
        "member.role",
        "member.left",
    } <= set(kinds)
    assert count(alice, ids["board"]) > before


def test_entries_have_actor_kind_and_titles_but_no_descriptions_or_comment_text(alice, ids):
    alice.patch(f"/api/cards/{ids['card']}", json={"details": "Secret text"})
    alice.post(f"/api/cards/{ids['card']}/comments", json={"text": "Private comment"})
    entries = alice.get(f"/api/boards/{ids['board']}/activity").json()
    assert entries[0]["kind"] == "comment.added"
    assert entries[0]["actor_email"] == "alice@example.com"
    assert entries[0]["card_id"] == ids["card"]
    assert "title" in entries[0]["data"]
    text = str(entries)
    assert "Secret text" not in text and "Private comment" not in text


def test_card_history_and_paging(alice, ids):
    for title in ("A", "B", "C"):
        alice.patch(f"/api/cards/{ids['card']}", json={"title": title})
    history = alice.get(f"/api/boards/{ids['board']}/activity?card_id={ids['card']}&limit=2").json()
    assert [h["data"]["title"] for h in history] == ["C", "B"]
    older = alice.get(
        f"/api/boards/{ids['board']}/activity?card_id={ids['card']}&before={history[-1]['id']}"
    ).json()
    assert older[0]["data"]["title"] == "A"


def test_only_members_read_activity(alice, ids):
    with TestClient(alice.app) as bob:
        sign_up(bob, "bob@example.com")
        assert bob.get(f"/api/boards/{ids['board']}/activity").status_code == 404


def test_keeps_the_newest_entries_per_board(alice, ids, monkeypatch):
    monkeypatch.setattr(activity_module, "KEEP", 5)
    for i in range(8):
        alice.patch(f"/api/cards/{ids['card']}", json={"title": f"T{i}"})
    assert count(alice, ids["board"]) == 5
    newest = alice.get(f"/api/boards/{ids['board']}/activity").json()[0]
    assert newest["data"]["title"] == "T7"
