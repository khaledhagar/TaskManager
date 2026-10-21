"""Board roles: what Viewer, Can update tasks, Full access and Admin may do.

T-510 to T-515, and T-689 for the Phase 24 endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from file_helpers import PDF, upload
from helpers import first_board, sign_up
from sharing_helpers import join, set_role, user_id
from sqlmodel import Session, select

from app.models import BoardMember, Role

VIEW_ONLY = "You can only view this board. Ask the board admin for permission to edit."
FULL_ACCESS = "Ask the board admin for full access to do this."
ADMIN_ONLY = "Only the board admin can do this."
RANK = ["viewer", "updater", "editor", "admin"]


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
    }


def requests_for(i):
    b, col, card, item = i["board"], i["column"], i["card"], i["item"]
    return [
        ("viewer", "get", f"/api/boards/{b}", None),
        ("viewer", "get", f"/api/boards/{b}/members", None),
        ("viewer", "get", f"/api/attachments/{i['attachment']}", None),
        ("viewer", "get", f"/api/boards/{b}/archived", None),
        ("viewer", "put", f"/api/boards/{b}/star", None),
        ("updater", "post", f"/api/cards/{card}/focus-sessions", {"minutes": 25}),
        ("updater", "post", f"/api/cards/{card}/move", {"column_id": col, "position": 0}),
        ("updater", "patch", f"/api/cards/{card}", {"completed": True}),
        ("updater", "patch", f"/api/checklist/{item}", {"done": True}),
        ("editor", "patch", f"/api/cards/{card}", {"title": "x"}),
        ("editor", "patch", f"/api/checklist/{item}", {"text": "x"}),
        ("editor", "post", f"/api/boards/{b}/columns", {"title": "x"}),
        ("editor", "post", f"/api/boards/{b}/columns/order", {"column_ids": []}),
        ("editor", "post", f"/api/boards/{b}/labels", {"name": "x", "color": "red"}),
        ("editor", "patch", f"/api/columns/{col}", {"title": "x"}),
        ("editor", "post", f"/api/columns/{col}/cards", {"title": "x"}),
        ("editor", "post", f"/api/cards/{card}/checklist", {"text": "x"}),
        ("editor", "put", f"/api/cards/{card}/labels", {"label_ids": []}),
        ("editor", "delete", f"/api/checklist/{item}", None),
        ("editor", "delete", f"/api/labels/{i['label']}", None),
        ("editor", "delete", f"/api/attachments/{i['attachment']}", None),
        ("editor", "post", f"/api/cards/{card}/archive", None),
        ("editor", "post", f"/api/columns/{col}/archive", None),
        ("editor", "post", f"/api/columns/{col}/restore", None),
        ("viewer", "get", f"/api/boards/{b}/archived-columns", None),
        ("editor", "post", f"/api/cards/{card}/restore", None),
        ("editor", "post", f"/api/cards/{card}/duplicate", None),
        ("editor", "put", f"/api/cards/{card}/cover", {"attachment_id": None}),
        ("editor", "patch", f"/api/columns/{col}", {"wip_limit": 3}),
        ("editor", "post", f"/api/boards/{b}/duplicate", None),
        ("editor", "post", "/api/templates", {"board_id": b, "name": "x"}),
        ("editor", "delete", f"/api/cards/{card}", None),
        ("editor", "delete", f"/api/columns/{col}", None),
        ("admin", "patch", f"/api/boards/{b}", {"title": "x"}),
        ("admin", "patch", f"/api/boards/{b}", {"auto_complete": True}),
        ("admin", "post", f"/api/boards/{b}/archive", None),
        ("admin", "post", f"/api/boards/{b}/restore", None),
        ("admin", "put", f"/api/boards/{b}/background/preset", {"preset": "dusk"}),
        ("admin", "delete", f"/api/boards/{b}/background", None),
        ("admin", "post", f"/api/boards/{b}/invites", {"email": "carol@example.com"}),
        ("admin", "delete", f"/api/boards/{b}", None),
    ]


CASES = [
    (need, method, url)
    for need, method, url, _ in requests_for(
        dict.fromkeys(["board", "column", "card", "item", "label", "attachment"], 0)
    )
]


@pytest.mark.parametrize("index", range(len(CASES)), ids=[f"{m} {u}" for _, m, u in CASES])
def test_each_endpoint_follows_the_role_table(index, alice, bob, ids):
    need, method, url, body = requests_for(ids)[index]
    member = join(alice, bob, ids["board"], "bob@example.com")
    for role in RANK[:3]:
        if role != "viewer":
            assert set_role(alice, ids["board"], member, role).status_code == 200
        r = bob.request(method, url, json=body)
        if RANK.index(role) < RANK.index(need):
            assert r.status_code == 403, (role, method, url, r.status_code)
            expected = (
                ADMIN_ONLY if need == "admin" else VIEW_ONLY if role == "viewer" else FULL_ACCESS
            )
            assert r.json()["detail"] == expected
        else:
            assert r.status_code not in (403, 404), (role, method, url, r.status_code, r.text)
            return
    r = alice.request(method, url, json=body)
    assert r.status_code not in (403, 404), (method, url, r.status_code)


def test_messages_in_arabic(alice, bob, ids):
    join(alice, bob, ids["board"], "bob@example.com")
    r = bob.post(
        f"/api/columns/{ids['column']}/cards",
        json={"title": "x"},
        headers={"Accept-Language": "ar"},
    )
    assert r.status_code == 403
    assert "المسؤول" in r.json()["detail"]


def test_owner_is_admin_and_backfill_is_idempotent(alice, ids):
    from app.sharing import backfill_admins

    with Session(alice.app.state.engine) as s:
        s.exec(select(BoardMember)).all()
        for m in s.exec(select(BoardMember)):
            s.delete(m)
        s.commit()
        backfill_admins(s)
        backfill_admins(s)
        rows = s.exec(select(BoardMember).where(BoardMember.board_id == ids["board"])).all()
    assert [(r.user_id, r.role) for r in rows] == [(user_id(alice), Role.admin)]


def test_role_in_request_is_ignored(alice, bob, ids):
    join(alice, bob, ids["board"], "bob@example.com")
    r = bob.post(f"/api/columns/{ids['column']}/cards", json={"title": "x", "role": "admin"})
    assert r.status_code in (403, 422)
    assert bob.get(f"/api/boards/{ids['board']}").json()["role"] == "viewer"


def test_board_shows_the_users_role(alice, bob, ids):
    join(alice, bob, ids["board"], "bob@example.com", "updater")
    assert alice.get(f"/api/boards/{ids['board']}").json()["role"] == "admin"
    assert bob.get(f"/api/boards/{ids['board']}").json()["role"] == "updater"


def test_board_list_has_owned_and_shared_boards(alice, bob, ids):
    join(alice, bob, ids["board"], "bob@example.com", "editor")
    roles = {b["id"]: b["role"] for b in bob.get("/api/boards").json()}
    assert roles[ids["board"]] == "editor"
    assert sorted(roles.values()) == ["admin", "editor"]


def test_cross_board_move_and_labels_refused_for_member_of_both(alice, bob, ids):
    join(alice, bob, ids["board"], "bob@example.com", "editor")
    own_id = next(b["id"] for b in bob.get("/api/boards").json() if b["role"] == "admin")
    own = bob.get(f"/api/boards/{own_id}").json()
    r = bob.post(
        f"/api/cards/{ids['card']}/move", json={"column_id": own["columns"][0]["id"], "position": 0}
    )
    assert r.status_code == 404
    own_label = own["labels"][0]["id"]
    assert (
        bob.put(f"/api/cards/{ids['card']}/labels", json={"label_ids": [own_label]}).status_code
        == 404
    )


def test_member_upload_counts_against_member_storage(alice, bob, ids):
    join(alice, bob, ids["board"], "bob@example.com", "editor")
    before = alice.get("/api/files/usage").json()["used"]
    assert upload(bob, ids["card"], "b.pdf", PDF, "application/pdf").status_code == 201
    assert bob.get("/api/files/usage").json()["used"] == len(PDF)
    assert alice.get("/api/files/usage").json()["used"] == before


def test_ai_chat_for_every_member_checklist_needs_full_access(alice, bob, ids, llm):
    from app.assistant import ChatDraft, ChecklistDraft

    join(alice, bob, ids["board"], "bob@example.com")
    llm.result = ChatDraft(reply="Hi", actions=[])
    assert (
        bob.post(
            "/api/ai/chat",
            json={"board_id": ids["board"], "messages": [{"role": "user", "content": "hi"}]},
        ).status_code
        == 200
    )
    llm.result = ChecklistDraft(items=["a"])
    assert bob.post(f"/api/ai/cards/{ids['card']}/checklist").status_code == 403
