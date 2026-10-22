"""Small helpers shared by API tests."""

import os

import pytest
from fastapi.testclient import TestClient

PASSWORD = "correct-horse"

sqlite_only = pytest.mark.skipif(
    bool(os.environ.get("TEST_DATABASE_URL")),
    reason="checks the local SQLite database, not a remote Postgres one",
)


def outbox(client: TestClient) -> list:
    return client.app.state.mailer.outbox


def link_token(client: TestClient, path: str = "/verify") -> str:
    """Token from the link in the most recent email for `path`."""
    text = outbox(client)[-1].text
    return text.split(f"{path}#token=")[1].split()[0]


def sign_up(client: TestClient, email: str = "alice@example.com") -> None:
    """Sign up and verify, leaving the client signed in."""
    r = client.post("/api/auth/signup", json={"email": email, "password": PASSWORD})
    assert r.status_code == 201
    r = client.post("/api/auth/verify", json={"token": link_token(client)})
    assert r.status_code == 200


def first_board(client: TestClient) -> dict:
    board_id = client.get("/api/boards").json()[0]["id"]
    return client.get(f"/api/boards/{board_id}").json()


def column_titles(board: dict) -> list[str]:
    return [c["title"] for c in board["columns"]]


def card_titles(column: dict) -> list[str]:
    return [c["title"] for c in column["cards"]]


class FakeLLM:
    """Stands in for `ai.complete`: records calls and returns a prepared draft."""

    def __init__(self):
        self.result = None
        self.calls = []

    def __call__(self, messages, schema, api_key):
        self.calls.append({"messages": messages, "schema": schema})
        return self.result

    @property
    def prompt(self) -> str:
        return "\n".join(m["content"] for m in self.calls[-1]["messages"])
