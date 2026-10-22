"""Security and quality checks: input limits, SQL text, secrets, chat safety, speed, file size."""

import subprocess
import time
from dataclasses import replace
from pathlib import Path

import coverage
import pytest
from fastapi.testclient import TestClient
from helpers import first_board, sign_up, sqlite_only
from sqlalchemy import event
from sqlmodel import Session

from app.assistant import ChatAction, ChatDraft
from app.factory import create_app
from app.models import Card

ROOT = Path(__file__).parents[2]


@pytest.fixture
def ids(client):
    sign_up(client)
    board = first_board(client)
    column = board["columns"][0]
    return {
        "board": board["id"],
        "column": column["id"],
        "card": column["cards"][0]["id"],
        "item": board["columns"][1]["cards"][0]["checklist"][0]["id"],
    }


# --- T-092 every string field has a length limit (SEC-40) ----------------------------------------

OVER = [
    ("post", "/api/boards", {"title": "x" * 201}),
    ("patch", "/api/boards/{board}", {"title": "x" * 201}),
    ("post", "/api/boards/{board}/columns", {"title": "x" * 201}),
    ("patch", "/api/columns/{column}", {"title": "x" * 201}),
    ("post", "/api/columns/{column}/cards", {"title": "x" * 201}),
    ("patch", "/api/cards/{card}", {"title": "x" * 201}),
    ("patch", "/api/cards/{card}", {"details": "x" * 10_001}),
    ("post", "/api/cards/{card}/checklist", {"text": "x" * 301}),
    ("patch", "/api/checklist/{item}", {"text": "x" * 301}),
    ("post", "/api/boards/{board}/labels", {"name": "x" * 41, "color": "red"}),
    ("post", "/api/ai/boards", {"description": "x" * 501}),
    (
        "post",
        "/api/ai/chat",
        {"board_id": 0, "messages": [{"role": "user", "content": "x" * 2001}]},
    ),  # noqa: E501
    ("post", "/api/auth/change-password", {"current_password": "x" * 129, "new_password": "y" * 9}),
]


@pytest.mark.parametrize(("method", "path", "body"), OVER)
def test_strings_over_their_limit_are_rejected(client, ids, method, path, body):
    r = getattr(client, method)(path.format(**ids), json=body)
    assert r.status_code == 422


def test_strings_at_their_limit_are_accepted(client, ids):
    assert client.patch(f"/api/cards/{ids['card']}", json={"title": "x" * 200}).status_code == 200
    r = client.patch(f"/api/cards/{ids['card']}", json={"details": "x" * 10_000})
    assert r.status_code == 200


# --- T-094 SQL-like text is just text (SEC-44) ---------------------------------------------------

SQL = "'; DROP TABLE cards;--"


def test_sql_like_input_is_stored_as_plain_text(client, ids):
    r = client.post(f"/api/columns/{ids['column']}/cards", json={"title": SQL})
    assert r.status_code == 201
    titles = [c["title"] for col in first_board(client)["columns"] for c in col["cards"]]
    assert SQL in titles
    assert len(titles) == 8


def test_no_sql_is_built_from_strings():
    """Only the health check uses raw SQL, and it is a constant."""
    for path in (ROOT / "backend" / "app").rglob("*.py"):
        source = path.read_text(encoding="utf-8")
        assert 'text(f"' not in source and "execute(f" not in source, path


# --- SEC-70 the API key stays on the server ------------------------------------------------------

SECRET = "sk-or-v1-test-secret-key-0123456789"


def test_api_key_never_reaches_the_browser(settings, llm):
    app = create_app(replace(settings, openrouter_api_key=SECRET))
    with TestClient(app) as c:
        sign_up(c)
        board = first_board(c)
        llm.result = ChatDraft(reply="ok")
        chat = {"board_id": board["id"], "messages": [{"role": "user", "content": "hi"}]}
        bodies = [
            c.get(path).text
            for path in ("/", "/api/auth/me", "/api/auth/config", "/api/boards", "/api/files/usage")
        ]
        bodies += [c.get(f"/api/boards/{board['id']}").text, c.post("/api/ai/chat", json=chat).text]
    app.state.engine.dispose()
    assert all(SECRET not in body for body in bodies)
    assert llm.calls  # the key was used, on the server only


def test_frontend_never_mentions_the_api_key():
    for path in (ROOT / "frontend" / "src").rglob("*.ts*"):
        assert "OPENROUTER" not in path.read_text(encoding="utf-8"), path


# --- SEC-71 chat proposes, the user confirms -----------------------------------------------------


def test_chat_actions_change_nothing_on_their_own(client, ids, llm):
    before = first_board(client)
    llm.result = ChatDraft(
        reply="Done?",
        actions=[
            ChatAction(type="create_card", column_id=ids["column"], title="New"),
            ChatAction(type="complete_card", card_id=ids["card"]),
            ChatAction(type="move_card", card_id=ids["card"], column_id=before["columns"][2]["id"]),
        ],
    )
    chat = {"board_id": ids["board"], "messages": [{"role": "user", "content": "tidy up"}]}
    assert len(client.post("/api/ai/chat", json=chat).json()["actions"]) == 3
    assert first_board(client) == before


# --- T-406 secrets are not committed (SEC-90) ----------------------------------------------------


def test_no_env_or_database_files_in_git():
    files = subprocess.run(  # noqa: S603
        ["git", "ls-files"],  # noqa: S607
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    ).stdout.splitlines()
    assert files
    assert not [f for f in files if f.endswith((".env", ".db")) or "/.env" in f or f == ".env"]


# --- NFR-01 a 500-card board loads quickly -------------------------------------------------------


@sqlite_only
def test_board_with_500_cards_loads_in_under_300_ms(client, ids):
    with Session(client.app.state.engine) as s:
        cards = (Card(column_id=ids["column"], title=f"C{i}", position=10 + i) for i in range(493))
        s.add_all(cards)
        s.commit()
    client.get(f"/api/boards/{ids['board']}")  # warm up
    # Coverage traces every line and makes Python several times slower; time the real speed.
    tracing = coverage.Coverage.current()
    if tracing:
        tracing.stop()
    # Best of 3: a one-off disk or antivirus pause on this machine must not fail the check.
    timings = []
    for _ in range(3):
        start = time.perf_counter()
        board = client.get(f"/api/boards/{ids['board']}").json()
        timings.append(time.perf_counter() - start)
    elapsed = min(timings)
    if tracing:
        tracing.start()
    assert sum(len(c["cards"]) for c in board["columns"]) == 500
    assert elapsed < 0.3, f"{elapsed * 1000:.0f} ms"


def test_board_loads_in_a_few_queries_whatever_its_size(client, ids):
    """Cards, labels, checklists, files and focus sessions come in one batch each, not per card."""
    with Session(client.app.state.engine) as s:
        s.add_all(
            Card(column_id=ids["column"], title=f"Card {i}", position=10 + i) for i in range(50)
        )
        s.commit()
    queries = []
    event.listen(client.app.state.engine, "before_cursor_execute", lambda *a: queries.append(1))
    client.get(f"/api/boards/{ids['board']}")
    assert len(queries) <= 13  # one batch per relation, focus sessions included


# --- NFR-42 short modules ------------------------------------------------------------------------


def test_no_backend_file_over_300_lines():
    long = [
        (path.name, n)
        for folder in ("app", "tests")
        for path in (ROOT / "backend" / folder).rglob("*.py")
        if (n := len(path.read_text(encoding="utf-8").splitlines())) > 300
    ]
    assert long == []
