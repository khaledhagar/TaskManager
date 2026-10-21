"""Board export as CSV (opens in Excel) and JSON (Phase 25, SEC-208)."""

import csv
import io

from app.models import Board, Card

FORMULA_START = ("=", "+", "-", "@", "\t", "\r")
HEADER = [
    "Title",
    "Column",
    "Priority",
    "Due date",
    "Completed",
    "Labels",
    "Assignees",
    "Checklist",
    "Description",
]


def safe_cell(text: str) -> str:
    """Spreadsheets run cells that start with = + - @ as formulas; a leading ' stops that."""
    return "'" + text if text.startswith(FORMULA_START) else text


def board_csv(board: Board) -> bytes:
    """One row per card; UTF-8 with a byte order mark so Excel shows Arabic correctly."""
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(HEADER)
    for column in board.columns:
        for card in column.cards:
            done = sum(i.done for i in card.checklist)
            row = [
                card.title,
                column.title,
                card.priority.value,
                card.due_date.isoformat() if card.due_date else "",
                "yes" if card.completed else "no",
                ", ".join(label.name for label in card.labels),
                ", ".join(u.email or "" for u in card.assignees),
                f"{done}/{len(card.checklist)}" if card.checklist else "",
                card.details,
            ]
            writer.writerow([safe_cell(cell) for cell in row])
    return ("﻿" + out.getvalue()).encode("utf-8")


def board_json(board: Board) -> dict:
    """The board's content and member emails; no ids, files, tokens or settings."""
    return {
        "title": board.title,
        "members": [m.user.email for m in board.members if m.user.email],
        "labels": [{"name": label.name, "color": label.color.value} for label in board.labels],
        "columns": [
            {"title": col.title, "cards": [_card(c) for c in col.cards]} for col in board.columns
        ],
    }


def _card(card: Card) -> dict:
    return {
        "title": card.title,
        "details": card.details,
        "priority": card.priority.value,
        "due_date": card.due_date.isoformat() if card.due_date else None,
        "completed": card.completed,
        "labels": [label.name for label in card.labels],
        "assignees": [u.email for u in card.assignees if u.email],
        "checklist": [{"text": i.text, "done": i.done} for i in card.checklist],
    }
