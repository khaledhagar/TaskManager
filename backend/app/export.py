"""Board export as CSV (opens in Excel) and JSON (Phase 25, SEC-208)."""

import csv
import io

from app.i18n import tr
from app.models import Board, Card

FORMULA_START = ("=", "+", "-", "@", "\t", "\r")
BOM = "﻿"


def safe_cell(text: str) -> str:
    """Spreadsheets run cells that start with = + - @ as formulas; a leading ' stops that."""
    return "'" + text if text.startswith(FORMULA_START) else text


def board_csv(board: Board) -> bytes:
    """Laid out like the board: each column's name heads its tasks, with a Status column beside it.

    UTF-8 with a byte order mark so Excel shows Arabic correctly; words follow the request language.
    """
    out = io.StringIO()
    writer = csv.writer(out)
    header: list[str] = []
    for column in board.columns:
        header += [column.title, tr("Status")]
    writer.writerow([safe_cell(cell) for cell in header])
    for i in range(max((len(c.cards) for c in board.columns), default=0)):
        row: list[str] = []
        for column in board.columns:
            card = column.cards[i] if i < len(column.cards) else None
            status = tr("Completed") if card and card.completed else tr("Open")
            row += [card.title, status] if card else ["", ""]
        writer.writerow([safe_cell(cell) for cell in row])
    return (BOM + out.getvalue()).encode("utf-8")


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
