"""Database models, seed data and templates (T-010 to T-013)."""

from datetime import date

import pytest
from sqlalchemy import text
from sqlmodel import Session, func, select

from app.models import Board, BoardColumn, Card, CardLabel, ChecklistItem, Label, User
from app.seed import build_board
from app.templates import TEMPLATES


@pytest.fixture
def user(session):
    u = User(email="a@example.com", password_hash="x")
    session.add(u)
    session.commit()
    return u


def count(session: Session, model) -> int:
    return session.exec(select(func.count()).select_from(model)).one()


def test_demo_board_seed(session, user):
    board = build_board(session, user.id, "demo")
    assert [c.title for c in board.columns] == ["To Do", "In Progress", "Done"]
    cards = [card for col in board.columns for card in col.cards]
    assert len(cards) == sum(len(c["cards"]) for c in TEMPLATES["en"]["demo"]["columns"])
    assert len(board.labels) >= 3
    assert any(card.checklist for card in cards)
    assert any(card.labels for card in cards)
    overdue = [c for c in cards if c.due_date and c.due_date < date.today() and not c.completed]
    assert overdue


def test_positions_are_contiguous(session, user):
    board = build_board(session, user.id, "demo")
    assert [c.position for c in board.columns] == list(range(len(board.columns)))
    for col in board.columns:
        assert [card.position for card in col.cards] == list(range(len(col.cards)))


@pytest.mark.parametrize("name", ["blank", "sprint", "bug_tracking", "personal"])
def test_templates_build_expected_columns(session, user, name):
    board = build_board(session, user.id, name)
    expected = [c["title"] for c in TEMPLATES["en"][name]["columns"]]
    assert [c.title for c in board.columns] == expected
    assert board.title == TEMPLATES["en"][name]["title"]


def test_blank_template_has_three_empty_columns(session, user):
    board = build_board(session, user.id, "blank", title="My board")
    assert board.title == "My board"
    assert [c.title for c in board.columns] == ["To Do", "In Progress", "Done"]
    assert all(not c.cards for c in board.columns)


def test_deleting_board_removes_children(session, user):
    board = build_board(session, user.id, "demo")
    session.delete(board)
    session.commit()
    for model in (Board, BoardColumn, Card, ChecklistItem, Label, CardLabel):
        assert count(session, model) == 0, model.__name__


def test_deleting_user_removes_boards(session, user):
    build_board(session, user.id, "demo")
    session.delete(user)
    session.commit()
    assert count(session, Board) == 0
    assert count(session, Card) == 0


def test_sqlite_pragmas(session):
    assert session.exec(text("PRAGMA foreign_keys")).one()[0] == 1
    assert session.exec(text("PRAGMA journal_mode")).one()[0] == "wal"
