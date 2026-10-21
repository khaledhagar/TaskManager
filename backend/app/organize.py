"""Copies of cards and boards, and the active-card limit (Phase 24)."""

from sqlmodel import Session, func, select

from app import limits
from app.access import not_found
from app.i18n import tr
from app.models import Board, BoardColumn, Card, ChecklistItem, User, UserTemplate

TEMPLATES_PER_USER = 20
CARD_LIMIT = "Maximum cards in a board is {cap}. Delete a card to add a new one."


def check_card_limit(session: Session, board_id: int) -> None:
    """Archived cards do not count toward the card limit."""
    stmt = (
        select(func.count())
        .select_from(Card)
        .join(BoardColumn)
        .where(BoardColumn.board_id == board_id, Card.archived_at == None)  # noqa: E711
    )
    limits.check(session.exec(stmt).one(), limits.CARDS_PER_BOARD, CARD_LIMIT)


def own_template(session: Session, user: User, template_id: int) -> UserTemplate:
    """A template is private: anyone else gets 404 (SEC-207)."""
    template = session.get(UserTemplate, template_id)
    if template is None or template.user_id != user.id:
        raise not_found()
    return template


def copy_title(title: str) -> str:
    suffix = tr(" (copy)")
    return title[: 200 - len(suffix)] + suffix


def copy_card(card: Card, position: int) -> Card:
    """Title, details, labels, checklist, priority and due date; not comments, files or people."""
    return Card(
        title=copy_title(card.title),
        details=card.details,
        completed=card.completed,
        priority=card.priority,
        due_date=card.due_date,
        position=position,
        labels=list(card.labels),
        checklist=[
            ChecklistItem(text=i.text, done=i.done, position=i.position) for i in card.checklist
        ],
    )


def board_to_data(board: Board, dates: bool = True) -> dict:
    """The board as template data (see `app.templates`); templates leave out due dates."""
    return {
        "title": board.title,
        "labels": [[label.name, label.color.value] for label in board.labels],
        "columns": [
            {"title": col.title, "cards": [_card_data(c, dates) for c in col.cards]}
            for col in board.columns
        ],
    }


def _card_data(card: Card, dates: bool) -> dict:
    return {
        "title": card.title,
        "details": card.details,
        "priority": card.priority.value,
        "completed": card.completed,
        "due_date": card.due_date.isoformat() if dates and card.due_date else None,
        "labels": [label.name for label in card.labels],
        "checklist": [[i.text, i.done] for i in card.checklist],
    }
