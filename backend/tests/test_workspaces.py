"""Workspaces that group boards; boards with chosen columns (T-720 to T-724; SEC-215)."""

import pytest
from fastapi.testclient import TestClient
from helpers import column_titles, first_board, sign_up
from sharing_helpers import join

from app import limits, workspaces


@pytest.fixture
def alice(client):
    sign_up(client, "alice@example.com")
    return client


@pytest.fixture
def bob(alice):
    with TestClient(alice.app) as c:
        sign_up(c, "bob@example.com")
        yield c


def new_workspace(client, name="Website relaunch", boards=()):
    return client.post("/api/workspaces", json={"name": name, "boards": list(boards)})


def board(client, board_id):
    return client.get(f"/api/boards/{board_id}").json()


def summary(client, board_id):
    return next(b for b in client.get("/api/boards").json() if b["id"] == board_id)


def test_create_workspace_with_boards_that_have_columns_and_no_cards(alice):
    r = new_workspace(
        alice,
        boards=[
            {"title": "Design", "columns": ["Ideas", "Drafts", "Approved"]},
            {"title": "Development", "columns": ["Backlog", "Doing", "Review", "Shipped"]},
        ],
    )
    assert r.status_code == 201
    body = r.json()
    assert body["workspace"]["name"] == "Website relaunch"
    assert [b["title"] for b in body["boards"]] == ["Design", "Development"]
    dev = board(alice, body["boards"][1]["id"])
    assert column_titles(dev) == ["Backlog", "Doing", "Review", "Shipped"]
    assert all(c["cards"] == [] for c in dev["columns"])
    assert summary(alice, dev["id"])["workspace_id"] == body["workspace"]["id"]
    assert alice.get("/api/workspaces").json() == [body["workspace"]]


def test_rename_and_delete_keeps_the_boards(alice):
    created = new_workspace(alice, boards=[{"title": "Ops", "columns": ["To Do"]}]).json()
    pid, bid = created["workspace"]["id"], created["boards"][0]["id"]
    r = alice.patch(f"/api/workspaces/{pid}", json={"name": "Relaunch 2"})
    assert r.status_code == 200 and r.json()["name"] == "Relaunch 2"
    assert alice.delete(f"/api/workspaces/{pid}").status_code == 204
    assert alice.get("/api/workspaces").json() == []
    assert summary(alice, bid)["workspace_id"] is None


def test_board_with_chosen_columns_and_a_workspace(alice):
    pid = new_workspace(alice).json()["workspace"]["id"]
    r = alice.post(
        "/api/boards", json={"title": "QA", "columns": ["Found", "Fixed"], "workspace_id": pid}
    )
    assert r.status_code == 201 and r.json()["workspace_id"] == pid
    made = board(alice, r.json()["id"])
    assert column_titles(made) == ["Found", "Fixed"]
    assert all(c["cards"] == [] for c in made["columns"])


def test_move_a_board_into_and_out_of_a_workspace(alice):
    pid = new_workspace(alice).json()["workspace"]["id"]
    bid = first_board(alice)["id"]
    r = alice.patch(f"/api/boards/{bid}", json={"workspace_id": pid})
    assert r.status_code == 200 and r.json()["workspace_id"] == pid
    r = alice.patch(f"/api/boards/{bid}", json={"title": "Renamed"})
    assert r.json()["workspace_id"] == pid
    assert (
        alice.patch(f"/api/boards/{bid}", json={"workspace_id": None}).json()["workspace_id"]
        is None
    )


def test_workspaces_are_private(alice, bob):
    pid = new_workspace(alice).json()["workspace"]["id"]
    assert bob.get("/api/workspaces").json() == []
    assert bob.patch(f"/api/workspaces/{pid}", json={"name": "x"}).status_code == 404
    assert bob.delete(f"/api/workspaces/{pid}").status_code == 404
    body = {"title": "Mine", "columns": ["A"], "workspace_id": pid}
    assert bob.post("/api/boards", json=body).status_code == 404
    own = first_board(bob)["id"]
    assert bob.patch(f"/api/boards/{own}", json={"workspace_id": pid}).status_code == 404


def test_shared_boards_never_show_someone_elses_workspace(alice, bob):
    pid = new_workspace(alice).json()["workspace"]["id"]
    bid = first_board(alice)["id"]
    alice.patch(f"/api/boards/{bid}", json={"workspace_id": pid})
    join(alice, bob, bid, "bob@example.com", "editor")
    assert summary(bob, bid)["workspace_id"] is None
    assert board(bob, bid)["workspace_id"] is None
    assert board(alice, bid)["workspace_id"] == pid
    bob_workspace = new_workspace(bob, "Bob's").json()["workspace"]["id"]
    r = bob.patch(f"/api/boards/{bid}", json={"workspace_id": bob_workspace})
    assert r.status_code == 403


def test_limits(alice, monkeypatch):
    for bad in ("", "x" * 101):
        assert new_workspace(alice, bad).status_code == 422
    eleven = [{"title": f"B{i}", "columns": ["A"]} for i in range(11)]
    assert new_workspace(alice, boards=eleven).status_code == 422
    for columns in ([], [f"C{i}" for i in range(21)]):
        assert new_workspace(alice, boards=[{"title": "B", "columns": columns}]).status_code == 422
    monkeypatch.setattr(workspaces, "WORKSPACES_PER_USER", 1)
    assert new_workspace(alice).status_code == 201
    assert new_workspace(alice).status_code == 400


def test_the_board_limit_counts_every_new_board(alice, monkeypatch):
    monkeypatch.setattr(limits, "BOARDS_PER_USER", 2)
    two = [{"title": f"B{i}", "columns": ["A"]} for i in range(2)]
    assert new_workspace(alice, boards=two).status_code == 400
    assert alice.get("/api/workspaces").json() == []
    assert new_workspace(alice, boards=two[:1]).status_code == 201
