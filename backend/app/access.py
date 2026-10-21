"""Ownership-checked lookups. Anything not owned by the user is reported as 404."""

from fastapi import HTTPException, status
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.i18n import tr
from app.models import Board, BoardColumn, Card, ChecklistItem, Label, User


def _found[T](obj: T | None) -> T:
    if obj is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, tr("Not found"))
    return obj


def owned_board(session: Session, user: User, board_id: int) -> Board:
    stmt = select(Board).where(Board.id == board_id, Board.owner_id == user.id)
    return _found(session.exec(stmt).first())


def owned_board_full(session: Session, user: User, board_id: int) -> Board:
    """The board with columns, cards and their details, loaded in a few queries (NFR-01)."""
    cards = selectinload(Board.columns).selectinload(BoardColumn.cards)
    stmt = (
        select(Board)
        .where(Board.id == board_id, Board.owner_id == user.id)
        .options(
            selectinload(Board.labels),
            cards.selectinload(Card.labels),
            cards.selectinload(Card.checklist),
            cards.selectinload(Card.attachments),
        )
    )
    return _found(session.exec(stmt).first())


def owned_column(session: Session, user: User, column_id: int) -> BoardColumn:
    stmt = (
        select(BoardColumn)
        .join(Board)
        .where(BoardColumn.id == column_id, Board.owner_id == user.id)
    )
    return _found(session.exec(stmt).first())


def owned_card(session: Session, user: User, card_id: int) -> Card:
    stmt = (
        select(Card)
        .join(BoardColumn)
        .join(Board)
        .where(Card.id == card_id, Board.owner_id == user.id)
    )
    return _found(session.exec(stmt).first())


def owned_item(session: Session, user: User, item_id: int) -> ChecklistItem:
    stmt = (
        select(ChecklistItem)
        .join(Card)
        .join(BoardColumn)
        .join(Board)
        .where(ChecklistItem.id == item_id, Board.owner_id == user.id)
    )
    return _found(session.exec(stmt).first())


def owned_label(session: Session, user: User, label_id: int) -> Label:
    stmt = select(Label).join(Board).where(Label.id == label_id, Board.owner_id == user.id)
    return _found(session.exec(stmt).first())


def board_labels(session: Session, board_id: int, label_ids: list[int]) -> list[Label]:
    """Return the labels with these ids, all of which must belong to the board."""
    ids = set(label_ids)
    stmt = select(Label).where(Label.board_id == board_id, Label.id.in_(ids))
    labels = session.exec(stmt).all()
    if len(labels) != len(ids):
        raise HTTPException(status.HTTP_404_NOT_FOUND, tr("Not found"))
    return list(labels)


def renumber(items: list) -> None:
    """Set `position` to the list index for every item."""
    for i, item in enumerate(items):
        item.position = i
