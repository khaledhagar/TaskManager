"""Card, move, checklist and card-label routes."""

from fastapi import APIRouter, Request
from sqlmodel import select

from app import limits
from app.access import board_labels, card_for, column_for, item_for, not_found, renumber
from app.activity import record
from app.auth import CurrentUser
from app.db import SessionDep
from app.models import BoardColumn, BoardMember, Card, ChecklistItem, Role, User
from app.notify import notify
from app.organize import check_card_limit
from app.schemas import (
    CardAssignees,
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
    column = column_for(session, user, column_id, Role.editor)
    check_card_limit(session, column.board_id)
    card = Card(**body.model_dump(), position=len(column.cards))
    column.cards.append(card)
    record(session, column.board_id, user, "card.added", card, column=column.title)
    session.commit()
    return card_out(card)


@router.patch("/cards/{card_id}")
def update_card(card_id: int, body: CardUpdate, user: CurrentUser, session: SessionDep) -> CardOut:
    changes = body.model_dump(exclude_unset=True)
    need = Role.updater if set(changes) <= {"completed"} else Role.editor
    card = card_for(session, user, card_id, need)
    if "completed" in changes and changes["completed"] is not None:
        kind, extra = ("card.completed" if changes["completed"] else "card.reopened"), {}
    elif changes.get("title") and changes["title"] != card.title:
        kind, extra = "card.renamed", {"old": card.title}
    else:
        kind, extra = "card.edited", {"fields": sorted(changes)}
    for field, value in changes.items():
        if value is not None or field == "due_date":
            setattr(card, field, value)
    record(session, card.column.board_id, user, kind, card, **extra)
    session.commit()
    return card_out(card)


@router.delete("/cards/{card_id}", status_code=204)
def delete_card(card_id: int, user: CurrentUser, session: SessionDep) -> None:
    card = card_for(session, user, card_id, Role.editor)
    column = card.column
    record(session, column.board_id, user, "card.deleted", title=card.title)
    session.delete(card)
    session.flush()
    session.refresh(column)
    renumber(column.cards)
    session.commit()


@router.post("/cards/{card_id}/move")
def move_card(card_id: int, body: CardMove, user: CurrentUser, session: SessionDep) -> CardOut:
    card = card_for(session, user, card_id, Role.updater)
    target = column_for(session, user, body.column_id, Role.updater)
    source = card.column
    if target.board_id != source.board_id:
        raise not_found()
    remaining = [c for c in source.cards if c.id != card.id]
    renumber(remaining)
    dest = remaining if target.id == source.id else list(target.cards)
    dest.insert(min(body.position, len(dest)), card)
    card.column_id = target.id
    renumber(dest)
    auto_complete(card, source, target)
    record(session, target.board_id, user, "card.moved", card, column=target.title)
    session.commit()
    session.refresh(card)
    return card_out(card)


def auto_complete(card: Card, source: BoardColumn, target: BoardColumn) -> None:
    """With the board setting on, the last column means done (T-687)."""
    board = target.board
    if not board.auto_complete or source.id == target.id:
        return
    last = board.columns[-1].id
    if target.id == last:
        card.completed = True
    elif source.id == last:
        card.completed = False


@router.put("/cards/{card_id}/labels")
def set_card_labels(
    card_id: int, body: CardLabels, user: CurrentUser, session: SessionDep
) -> CardOut:
    card = card_for(session, user, card_id, Role.editor)
    card.labels = board_labels(session, card.column.board_id, body.label_ids)
    record(session, card.column.board_id, user, "card.labels", card)
    session.commit()
    return card_out(card)


@router.put("/cards/{card_id}/assignees")
def set_assignees(
    card_id: int, body: CardAssignees, request: Request, user: CurrentUser, session: SessionDep
) -> CardOut:
    """Only members of the card's board can be assigned (SEC-168)."""
    card = card_for(session, user, card_id, Role.editor)
    ids = set(body.user_ids)
    stmt = select(BoardMember.user_id).where(BoardMember.board_id == card.column.board_id)
    if not ids <= set(session.exec(stmt)):
        raise not_found()
    before = {u.id for u in card.assignees}
    card.assignees = list(session.exec(select(User).where(User.id.in_(ids))))
    record(session, card.column.board_id, user, "card.assigned", card, people=len(ids))
    state = request.app.state
    for person in card.assignees:
        if person.id not in before:
            notify(
                session,
                state.mailer,
                state.settings,
                person,
                "assigned",
                card.column.board,
                card,
                user,
            )
    session.commit()
    return card_out(card)


@router.post("/cards/{card_id}/checklist", status_code=201)
def add_item(card_id: int, body: ItemCreate, user: CurrentUser, session: SessionDep) -> ItemOut:
    card = card_for(session, user, card_id, Role.editor)
    limits.check(
        len(card.checklist),
        limits.ITEMS_PER_CARD,
        "Limit reached: at most {cap} checklist items per card",
    )
    item = ChecklistItem(text=body.text, position=len(card.checklist))
    card.checklist.append(item)
    record(session, card.column.board_id, user, "checklist.added", card, item=body.text)
    session.commit()
    return ItemOut.model_validate(item)


@router.patch("/checklist/{item_id}")
def update_item(item_id: int, body: ItemUpdate, user: CurrentUser, session: SessionDep) -> ItemOut:
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    need = Role.updater if set(changes) <= {"done"} else Role.editor
    item = item_for(session, user, item_id, need)
    if "done" in changes:
        kind = "checklist.checked" if changes["done"] else "checklist.unchecked"
    else:
        kind = "checklist.edited"
    for field, value in changes.items():
        setattr(item, field, value)
    record(session, item.card.column.board_id, user, kind, item.card, item=item.text)
    session.commit()
    return ItemOut.model_validate(item)


@router.delete("/checklist/{item_id}", status_code=204)
def delete_item(item_id: int, user: CurrentUser, session: SessionDep) -> None:
    item = item_for(session, user, item_id, Role.editor)
    card = item.card
    record(session, card.column.board_id, user, "checklist.deleted", card, item=item.text)
    session.delete(item)
    session.flush()
    session.refresh(card)
    renumber(card.checklist)
    session.commit()
