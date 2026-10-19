"""Authorization: users only reach their own data (T-080 to T-084)."""

import re

import pytest
from fastapi.testclient import TestClient
from helpers import first_board, sign_up


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
def alice_ids(alice):
    board = first_board(alice)
    card = board["columns"][1]["cards"][0]
    return {
        "board": board["id"],
        "column": board["columns"][0]["id"],
        "card": card["id"],
        "item": card["checklist"][0]["id"],
        "label": board["labels"][0]["id"],
    }


def requests_for(ids):
    b, col, card, item, lbl = ids["board"], ids["column"], ids["card"], ids["item"], ids["label"]
    return [
        ("get", f"/api/boards/{b}", None),
        ("patch", f"/api/boards/{b}", {"title": "x"}),
        ("delete", f"/api/boards/{b}", None),
        ("post", f"/api/boards/{b}/columns", {"title": "x"}),
        ("post", f"/api/boards/{b}/columns/order", {"column_ids": []}),
        ("post", f"/api/boards/{b}/labels", {"name": "x", "color": "red"}),
        ("patch", f"/api/columns/{col}", {"title": "x"}),
        ("delete", f"/api/columns/{col}", None),
        ("post", f"/api/columns/{col}/cards", {"title": "x"}),
        ("patch", f"/api/cards/{card}", {"title": "x"}),
        ("delete", f"/api/cards/{card}", None),
        ("post", f"/api/cards/{card}/move", {"column_id": col, "position": 0}),
        ("post", f"/api/cards/{card}/checklist", {"text": "x"}),
        ("put", f"/api/cards/{card}/labels", {"label_ids": []}),
        ("patch", f"/api/checklist/{item}", {"done": True}),
        ("delete", f"/api/checklist/{item}", None),
        ("delete", f"/api/labels/{lbl}", None),
    ]


def test_other_users_resources_are_404(alice_ids, bob, alice):
    for method, url, body in requests_for(alice_ids):
        r = bob.request(method, url, json=body)
        assert r.status_code == 404, (method, url, r.status_code)
    assert first_board(alice)["id"] == alice_ids["board"]
    assert len(first_board(alice)["columns"]) == 3


def test_bob_lists_only_his_boards(alice_ids, bob):
    assert alice_ids["board"] not in [b["id"] for b in bob.get("/api/boards").json()]


def test_cannot_move_card_into_other_users_column(alice_ids, bob):
    bob_card = first_board(bob)["columns"][0]["cards"][0]["id"]
    r = bob.post(
        f"/api/cards/{bob_card}/move", json={"column_id": alice_ids["column"], "position": 0}
    )
    assert r.status_code == 404


def test_cannot_use_other_boards_label(alice_ids, bob):
    bob_card = first_board(bob)["columns"][0]["cards"][0]["id"]
    r = bob.put(f"/api/cards/{bob_card}/labels", json={"label_ids": [alice_ids["label"]]})
    assert r.status_code == 404


def test_label_from_own_other_board_rejected(alice):
    board = first_board(alice)
    other = alice.post("/api/boards", json={"template": "sprint"}).json()["id"]
    other_label = alice.get(f"/api/boards/{other}").json()["labels"][0]["id"]
    card = board["columns"][0]["cards"][0]["id"]
    r = alice.put(f"/api/cards/{card}/labels", json={"label_ids": [other_label]})
    assert r.status_code == 404


def test_every_data_endpoint_requires_sign_in(client):
    open_paths = {
        "/api/health",
        "/api/auth/signup",
        "/api/auth/signin",
        "/api/auth/guest",
        "/api/auth/signout",
    }
    checked = 0
    for path, operations in client.app.openapi()["paths"].items():
        if path in open_paths:
            continue
        url = re.sub(r"\{[^}]+\}", "1", path)
        for method in operations:
            r = client.request(method, url, json={})
            assert r.status_code == 401, (method, path, r.status_code)
            checked += 1
    assert checked >= 20
