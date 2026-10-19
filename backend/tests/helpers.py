"""Small helpers shared by API tests."""

from fastapi.testclient import TestClient


def sign_up(client: TestClient, email: str = "alice@example.com") -> None:
    r = client.post("/api/auth/signup", json={"email": email, "password": "correct-horse"})
    assert r.status_code == 201


def first_board(client: TestClient) -> dict:
    board_id = client.get("/api/boards").json()[0]["id"]
    return client.get(f"/api/boards/{board_id}").json()


def column_titles(board: dict) -> list[str]:
    return [c["title"] for c in board["columns"]]


def card_titles(column: dict) -> list[str]:
    return [c["title"] for c in column["cards"]]
