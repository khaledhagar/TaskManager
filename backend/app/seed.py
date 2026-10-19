"""Build boards from template data."""

from datetime import date, timedelta

from sqlmodel import Session

from app.models import Board, BoardColumn, Card, ChecklistItem, Label
from app.templates import TEMPLATES


def build_board(session: Session, owner_id: int, template: str, title: str | None = None) -> Board:
    """Create a board with the template's labels, columns, cards and checklists."""
    data = TEMPLATES[template]
    board = Board(owner_id=owner_id, title=title or data["title"])
    labels = {name: Label(name=name, color=color) for name, color in data["labels"]}
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
    return Card(
        title=data["title"],
        details=data.get("details", ""),
        priority=data.get("priority", "medium"),
        completed=data.get("completed", False),
        due_date=date.today() + timedelta(days=due) if due is not None else None,
        position=position,
        labels=[labels[name] for name in data.get("labels", [])],
        checklist=[
            ChecklistItem(text=text, done=done, position=k)
            for k, (text, done) in enumerate(data.get("checklist", []))
        ],
    )
