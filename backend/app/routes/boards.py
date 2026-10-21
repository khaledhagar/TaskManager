"""Board, column and label routes."""

from fastapi import APIRouter, HTTPException, Request, status
from sqlmodel import func, select

from app import limits
from app.access import board_for, board_full_for, board_role, column_for, label_for, renumber
from app.auth import CurrentUser
from app.db import SessionDep
from app.i18n import tr
from app.models import Board, BoardColumn, BoardMember, Label, Role
from app.schemas import (
    BoardCreate,
    BoardOut,
    BoardSummary,
    ColumnOrder,
    ColumnOut,
    LabelCreate,
    LabelOut,
    TitleUpdate,
    board_out,
    board_summary,
    column_out,
)
from app.seed import build_board

router = APIRouter(prefix="/api", tags=["boards"])


@router.get("/boards")
def list_boards(user: CurrentUser, session: SessionDep) -> list[BoardSummary]:
    stmt = (
        select(Board, BoardMember.role)
        .join(BoardMember)
        .where(BoardMember.user_id == user.id)
        .order_by(Board.created_at, Board.id)
    )
    return [board_summary(board, role) for board, role in session.exec(stmt)]


@router.post("/boards", status_code=201)
def create_board(body: BoardCreate, user: CurrentUser, session: SessionDep) -> BoardSummary:
    count = session.exec(select(func.count()).where(Board.owner_id == user.id)).one()
    limits.check(count, limits.BOARDS_PER_USER, "Limit reached: at most {cap} boards")
    board = build_board(session, user.id, body.template, body.title)
    return board_summary(board, Role.admin)


@router.get("/boards/{board_id}")
def get_board(board_id: int, request: Request, user: CurrentUser, session: SessionDep) -> BoardOut:
    board = board_full_for(session, user, board_id)
    role = board_role(session, user, board_id)
    return board_out(board, role, request.app.state.settings.app_url)


@router.patch("/boards/{board_id}")
def rename_board(
    board_id: int, body: TitleUpdate, user: CurrentUser, session: SessionDep
) -> BoardSummary:
    board = board_for(session, user, board_id, Role.admin)
    board.title = body.title
    session.commit()
    return board_summary(board, Role.admin)


@router.delete("/boards/{board_id}", status_code=204)
def delete_board(board_id: int, user: CurrentUser, session: SessionDep) -> None:
    session.delete(board_for(session, user, board_id, Role.admin))
    session.commit()


@router.post("/boards/{board_id}/columns", status_code=201)
def add_column(
    board_id: int, body: TitleUpdate, user: CurrentUser, session: SessionDep
) -> ColumnOut:
    board = board_for(session, user, board_id, Role.editor)
    limits.check(
        len(board.columns),
        limits.COLUMNS_PER_BOARD,
        "Limit reached: at most {cap} columns per board",
    )
    column = BoardColumn(title=body.title, position=len(board.columns))
    board.columns.append(column)
    session.commit()
    return column_out(column)


@router.post("/boards/{board_id}/columns/order", status_code=204)
def reorder_columns(
    board_id: int, body: ColumnOrder, user: CurrentUser, session: SessionDep
) -> None:
    board = board_for(session, user, board_id, Role.editor)
    by_id = {c.id: c for c in board.columns}
    if len(body.column_ids) != len(by_id) or set(body.column_ids) != set(by_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, tr("Order must list every column once"))
    renumber([by_id[i] for i in body.column_ids])
    session.commit()


@router.patch("/columns/{column_id}")
def rename_column(
    column_id: int, body: TitleUpdate, user: CurrentUser, session: SessionDep
) -> ColumnOut:
    column = column_for(session, user, column_id, Role.editor)
    column.title = body.title
    session.commit()
    return column_out(column)


@router.delete("/columns/{column_id}", status_code=204)
def delete_column(column_id: int, user: CurrentUser, session: SessionDep) -> None:
    column = column_for(session, user, column_id, Role.editor)
    board = column.board
    session.delete(column)
    session.flush()
    session.refresh(board)
    renumber(board.columns)
    session.commit()


@router.post("/boards/{board_id}/labels", status_code=201)
def add_label(board_id: int, body: LabelCreate, user: CurrentUser, session: SessionDep) -> LabelOut:
    board = board_for(session, user, board_id, Role.editor)
    limits.check(
        len(board.labels), limits.LABELS_PER_BOARD, "Limit reached: at most {cap} labels per board"
    )
    label = Label(name=body.name, color=body.color)
    board.labels.append(label)
    session.commit()
    return LabelOut.model_validate(label)


@router.delete("/labels/{label_id}", status_code=204)
def delete_label(label_id: int, user: CurrentUser, session: SessionDep) -> None:
    session.delete(label_for(session, user, label_id, Role.editor))
    session.commit()
