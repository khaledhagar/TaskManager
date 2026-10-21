"""Build boards from template data."""

from datetime import date, timedelta

from sqlmodel import Session

from app.i18n import current_language
from app.models import Board, BoardColumn, BoardMember, Card, ChecklistItem, Label, Role
from app.templates import TEMPLATES


def build_board(session: Session, owner_id: int, template: str, title: str | None = None) -> Board:
    """Create a board from a named template, in the request language."""
    return build_from_data(session, owner_id, TEMPLATES[current_language()][template], title)


def build_from_data(session: Session, owner_id: int, data: dict, title: str | None = None) -> Board:
    """Create a board with the data's labels, columns, cards and checklists.

    Cards take `due` (days from today) or `due_date` (ISO date, used by board copies).
    """
    board = Board(owner_id=owner_id, title=title or data["title"])
    board.members = [BoardMember(user_id=owner_id, role=Role.admin)]
    labels = {name: Label(name=name, color=color) for name, color in data.get("labels", [])}
    board.labels = list(labels.values())
    board.columns = [
        BoardColumn(
            title=col["title"],
            position=i,
            cards=[_card(card, j, labels) for j, card in enumerate(col["cards"])],
        )
        for i, col in enumerate(data["columns"])
    ]
    session.add(board)
    session.commit()
    session.refresh(board)
    return board


def _card(data: dict, position: int, labels: dict[str, Label]) -> Card:
    due = data.get("due")
    due_date = date.today() + timedelta(days=due) if due is not None else None
    if data.get("due_date"):
        due_date = date.fromisoformat(data["due_date"])
    return Card(
        title=data["title"],
        details=data.get("details", ""),
        priority=data.get("priority", "medium"),
        completed=data.get("completed", False),
        due_date=due_date,
        position=position,
        labels=[labels[name] for name in data.get("labels", [])],
        checklist=[
            ChecklistItem(text=text, done=done, position=k)
            for k, (text, done) in enumerate(data.get("checklist", []))
        ],
    )
