"""Card, move, checklist and card-label routes."""

from fastapi import APIRouter
from sqlmodel import func, select

from app import limits
from app.access import board_labels, owned_card, owned_column, owned_item, renumber
from app.auth import CurrentUser
from app.db import SessionDep
from app.models import BoardColumn, Card, ChecklistItem
from app.schemas import (
    CardCreate,
    CardLabels,
    CardMove,
    CardOut,
    CardUpdate,
    ItemCreate,
    ItemOut,
    ItemUpdate,
    card_out,
)

router = APIRouter(prefix="/api", tags=["cards"])


@router.post("/columns/{column_id}/cards", status_code=201)
def add_card(column_id: int, body: CardCreate, user: CurrentUser, session: SessionDep) -> CardOut:
    column = owned_column(session, user, column_id)
    stmt = select(func.count()).select_from(Card).join(BoardColumn)
    count = session.exec(stmt.where(BoardColumn.board_id == column.board_id)).one()
    limits.check(count, limits.CARDS_PER_BOARD, "cards per board")
    card = Card(**body.model_dump(), position=len(column.cards))
    column.cards.append(card)
    session.commit()
    return card_out(card)


@router.patch("/cards/{card_id}")
def update_card(card_id: int, body: CardUpdate, user: CurrentUser, session: SessionDep) -> CardOut:
    card = owned_card(session, user, card_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is not None or field == "due_date":
            setattr(card, field, value)
    session.commit()
    return card_out(card)


@router.delete("/cards/{card_id}", status_code=204)
def delete_card(card_id: int, user: CurrentUser, session: SessionDep) -> None:
    card = owned_card(session, user, card_id)
    column = card.column
    session.delete(card)
    session.flush()
    session.refresh(column)
    renumber(column.cards)
    session.commit()


@router.post("/cards/{card_id}/move")
def move_card(card_id: int, body: CardMove, user: CurrentUser, session: SessionDep) -> CardOut:
    card = owned_card(session, user, card_id)
    target = owned_column(session, user, body.column_id)
    source = card.column
    remaining = [c for c in source.cards if c.id != card.id]
    renumber(remaining)
    dest = remaining if target.id == source.id else list(target.cards)
    dest.insert(min(body.position, len(dest)), card)
    card.column_id = target.id
    renumber(dest)
    session.commit()
    session.refresh(card)
    return card_out(card)


@router.put("/cards/{card_id}/labels")
def set_card_labels(
    card_id: int, body: CardLabels, user: CurrentUser, session: SessionDep
) -> CardOut:
    card = owned_card(session, user, card_id)
    card.labels = board_labels(session, card.column.board_id, body.label_ids)
    session.commit()
    return card_out(card)


@router.post("/cards/{card_id}/checklist", status_code=201)
def add_item(card_id: int, body: ItemCreate, user: CurrentUser, session: SessionDep) -> ItemOut:
    card = owned_card(session, user, card_id)
    limits.check(len(card.checklist), limits.ITEMS_PER_CARD, "checklist items per card")
    item = ChecklistItem(text=body.text, position=len(card.checklist))
    card.checklist.append(item)
    session.commit()
    return ItemOut.model_validate(item)


@router.patch("/checklist/{item_id}")
def update_item(item_id: int, body: ItemUpdate, user: CurrentUser, session: SessionDep) -> ItemOut:
    item = owned_item(session, user, item_id)
    for field, value in body.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(item, field, value)
    session.commit()
    return ItemOut.model_validate(item)


@router.delete("/checklist/{item_id}", status_code=204)
def delete_item(item_id: int, user: CurrentUser, session: SessionDep) -> None:
    item = owned_item(session, user, item_id)
    card = item.card
    session.delete(item)
    session.flush()
    session.refresh(card)
    renumber(card.checklist)
    session.commit()
