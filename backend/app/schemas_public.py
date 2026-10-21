"""What a public board shows to anyone with its link (Phase 20)."""

from datetime import date

from pydantic import BaseModel

from app.models import Board, Priority
from app.schemas import BackgroundOut, ItemOut, LabelOut, background_out


class PublicCardOut(BaseModel):
    """A card on a public board: no attachments, no assignees."""

    id: int
    title: str
    details: str
    completed: bool
    priority: Priority
    due_date: date | None
    label_ids: list[int]
    checklist: list[ItemOut]


class PublicColumnOut(BaseModel):
    id: int
    title: str
    cards: list[PublicCardOut]


class PublicBoardOut(BaseModel):
    """What anyone with the link sees: no board id, members, files or AI."""

    title: str
    labels: list[LabelOut]
    columns: list[PublicColumnOut]
    background: BackgroundOut


def public_board_out(board: Board) -> PublicBoardOut:
    return PublicBoardOut(
        title=board.title,
        labels=[LabelOut.model_validate(lbl) for lbl in board.labels],
        columns=[
            PublicColumnOut(
                id=col.id,
                title=col.title,
                cards=[
                    PublicCardOut(
                        id=c.id,
                        title=c.title,
                        details=c.details,
                        completed=c.completed,
                        priority=c.priority,
                        due_date=c.due_date,
                        label_ids=sorted(lbl.id for lbl in c.labels),
                        checklist=[ItemOut.model_validate(i) for i in c.checklist],
                    )
                    for c in col.cards
                ],
            )
            for col in board.columns
        ],
        background=background_out(board),
    )
