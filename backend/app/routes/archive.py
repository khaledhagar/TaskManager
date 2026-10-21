"""Archive, restore and duplicate cards and boards (T-680 to T-683)."""

from fastapi import APIRouter
from sqlmodel import func, select

from app import limits
from app.access import board_for, board_full_for, card_for, renumber
from app.activity import record
from app.auth import CurrentUser
from app.db import SessionDep
from app.models import Board, BoardColumn, Card, Role, utcnow
from app.organize import board_to_data, check_card_limit, copy_card, copy_title
from app.schemas import BoardSummary, CardOut, board_summary, card_out
from app.schemas_organize import ArchivedCardOut
from app.seed import build_from_data

router = APIRouter(prefix="/api", tags=["organize"])


@router.post("/cards/{card_id}/archive", status_code=204)
def archive_card(card_id: int, user: CurrentUser, session: SessionDep) -> None:
    card = card_for(session, user, card_id, Role.editor)
    column = card.column
    card.archived_at = utcnow()
    record(session, column.board_id, user, "card.archived", card)
    session.flush()
    session.refresh(column)
    renumber(column.cards)
    session.commit()


@router.post("/cards/{card_id}/restore")
def restore_card(card_id: int, user: CurrentUser, session: SessionDep) -> CardOut:
    """Back to the end of its column, if the board has room."""
    card = card_for(session, user, card_id, Role.editor)
    if card.archived_at is not None:
        check_card_limit(session, card.column.board_id)
        card.position = len(card.column.cards)
        card.archived_at = None
        record(session, card.column.board_id, user, "card.restored", card)
        session.commit()
    return card_out(card)


@router.get("/boards/{board_id}/archived")
def archived_cards(board_id: int, user: CurrentUser, session: SessionDep) -> list[ArchivedCardOut]:
    board_for(session, user, board_id)
    rows = session.exec(
        select(Card, BoardColumn.title)
        .join(BoardColumn)
        .where(BoardColumn.board_id == board_id, Card.archived_at != None)  # noqa: E711
        .order_by(Card.archived_at.desc())
    )
    return [
        ArchivedCardOut(
            id=card.id,
            title=card.title,
            column_id=card.column_id,
            column_title=column_title,
            archived_at=card.archived_at,
        )
        for card, column_title in rows
    ]


@router.post("/cards/{card_id}/duplicate", status_code=201)
def duplicate_card(card_id: int, user: CurrentUser, session: SessionDep) -> CardOut:
    """The copy goes right after the original."""
    card = card_for(session, user, card_id, Role.editor)
    column = card.column
    check_card_limit(session, column.board_id)
    cards = list(column.cards)
    copy = copy_card(card, card.position + 1)
    cards.insert(card.position + 1, copy)
    column.cards = cards
    renumber(cards)
    record(session, column.board_id, user, "card.duplicated", copy, source=card.title)
    session.commit()
    return card_out(copy)


@router.post("/boards/{board_id}/archive")
def archive_board(board_id: int, user: CurrentUser, session: SessionDep) -> BoardSummary:
    board = board_for(session, user, board_id, Role.admin)
    board.archived_at = utcnow()
    record(session, board_id, user, "board.archived")
    session.commit()
    return board_summary(board, Role.admin)


@router.post("/boards/{board_id}/restore")
def restore_board(board_id: int, user: CurrentUser, session: SessionDep) -> BoardSummary:
    board = board_for(session, user, board_id, Role.admin)
    board.archived_at = None
    record(session, board_id, user, "board.restored")
    session.commit()
    return board_summary(board, Role.admin)


@router.post("/boards/{board_id}/duplicate", status_code=201)
def duplicate_board(board_id: int, user: CurrentUser, session: SessionDep) -> BoardSummary:
    """Columns, cards, labels and checklists; not members, comments or files (SEC-207)."""
    board_for(session, user, board_id, Role.editor)
    board = board_full_for(session, user, board_id)
    count = session.exec(select(func.count()).where(Board.owner_id == user.id)).one()
    limits.check(count, limits.BOARDS_PER_USER, "Limit reached: at most {cap} boards")
    copy = build_from_data(session, user.id, board_to_data(board), copy_title(board.title))
    record(session, copy.id, user, "board.created", board=copy.title)
    session.commit()
    return board_summary(copy, Role.admin)
