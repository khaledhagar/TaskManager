"""Board, column and label routes."""

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import case
from sqlmodel import func, select

from app import limits
from app.access import board_for, board_full_for, board_role, column_for, label_for, renumber
from app.activity import record
from app.auth import CurrentUser
from app.db import SessionDep
from app.i18n import current_language, tr
from app.models import Board, BoardColumn, BoardMember, BoardStar, Card, Comment, Label, Role
from app.organize import own_template
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
from app.schemas_organize import BoardUpdate, ColumnUpdate
from app.seed import build_board, build_from_data
from app.templates import TEMPLATES
from app.workspaces import board_with_columns, check_board_room, own_workspace, own_workspace_ids

router = APIRouter(prefix="/api", tags=["boards"])


@router.get("/boards")
def list_boards(user: CurrentUser, session: SessionDep) -> list[BoardSummary]:
    stmt = (
        select(Board, BoardMember.role)
        .join(BoardMember)
        .where(BoardMember.user_id == user.id)
        .order_by(Board.created_at, Board.id)
    )
    starred = set(session.exec(select(BoardStar.board_id).where(BoardStar.user_id == user.id)))
    mine = own_workspace_ids(session, user)
    counts = card_counts(session, user)
    out = []
    for b, role in session.exec(stmt):
        summary = board_summary(
            b, role, b.id in starred, b.workspace_id if b.workspace_id in mine else None
        )
        summary.cards, summary.done = counts.get(b.id, (0, 0))
        out.append(summary)
    return out


def card_counts(session, user) -> dict[int, tuple[int, int]]:
    """Active cards and done cards per board the user belongs to, in one query."""
    stmt = (
        select(BoardColumn.board_id, func.count(), func.sum(case((Card.completed, 1), else_=0)))
        .join(Card, Card.column_id == BoardColumn.id)
        .join(BoardMember, BoardMember.board_id == BoardColumn.board_id)
        .where(BoardMember.user_id == user.id, Card.archived_at == None)  # noqa: E711
        .where(BoardColumn.archived_at == None)  # noqa: E711
        .group_by(BoardColumn.board_id)
    )
    return {board_id: (total, done) for board_id, total, done in session.exec(stmt)}


@router.post("/boards", status_code=201)
def create_board(body: BoardCreate, user: CurrentUser, session: SessionDep) -> BoardSummary:
    check_board_room(session, user)
    if body.workspace_id is not None:
        own_workspace(session, user, body.workspace_id)
    if body.columns:
        title = body.title or TEMPLATES[current_language()]["blank"]["title"]
        board = board_with_columns(session, user, title, body.columns, body.workspace_id)
    elif body.template_id is not None:
        data = own_template(session, user, body.template_id).data
        board = build_from_data(session, user.id, data, body.title)
    else:
        board = build_board(session, user.id, body.template, body.title)
    record(session, board.id, user, "board.created", board=board.title)
    session.commit()
    return board_summary(board, Role.admin, workspace_id=board.workspace_id)


@router.get("/boards/{board_id}")
def get_board(board_id: int, request: Request, user: CurrentUser, session: SessionDep) -> BoardOut:
    board = board_full_for(session, user, board_id)
    role = board_role(session, user, board_id)
    counts = (
        select(Comment.card_id, func.count())
        .join(Card)
        .join(BoardColumn)
        .where(BoardColumn.board_id == board_id)
        .group_by(Comment.card_id)
    )
    comment_counts = dict(session.exec(counts).all())
    out = board_out(board, role, request.app.state.settings.app_url, comment_counts)
    # Workspaces are private: only the owner sees which one the board is in.
    out.workspace_id = board.workspace_id if board.owner_id == user.id else None
    return out


@router.patch("/boards/{board_id}")
def update_board(
    board_id: int, body: BoardUpdate, user: CurrentUser, session: SessionDep
) -> BoardSummary:
    """Rename, turn auto-complete on or off, or move into or out of a workspace (admin)."""
    board = board_for(session, user, board_id, Role.admin)
    if "workspace_id" in body.model_fields_set:
        if body.workspace_id is not None:
            own_workspace(session, user, body.workspace_id)
        board.workspace_id = body.workspace_id
    if body.title is not None:
        record(session, board_id, user, "board.renamed", board=body.title, old=board.title)
        board.title = body.title
    if body.auto_complete is not None:
        board.auto_complete = body.auto_complete
        record(session, board_id, user, "board.autocomplete", on=body.auto_complete)
    session.commit()
    return board_summary(board, Role.admin, workspace_id=board.workspace_id)


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
    record(session, board_id, user, "column.added", column=body.title)
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
    record(session, board_id, user, "columns.reordered")
    session.commit()


@router.patch("/columns/{column_id}")
def update_column(
    column_id: int, body: ColumnUpdate, user: CurrentUser, session: SessionDep
) -> ColumnOut:
    """Rename, or set the WIP limit (null clears it)."""
    column = column_for(session, user, column_id, Role.editor)
    board_id = column.board_id
    if body.title is not None:
        record(session, board_id, user, "column.renamed", column=body.title, old=column.title)
        column.title = body.title
    if "wip_limit" in body.model_fields_set:
        column.wip_limit = body.wip_limit
        record(session, board_id, user, "column.wip", column=column.title, cap=body.wip_limit)
    session.commit()
    return column_out(column)


@router.delete("/columns/{column_id}", status_code=204)
def delete_column(column_id: int, user: CurrentUser, session: SessionDep) -> None:
    column = column_for(session, user, column_id, Role.editor)
    board = column.board
    record(session, board.id, user, "column.deleted", column=column.title)
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
    record(session, board_id, user, "label.added", label=body.name)
    session.commit()
    return LabelOut.model_validate(label)


@router.delete("/labels/{label_id}", status_code=204)
def delete_label(label_id: int, user: CurrentUser, session: SessionDep) -> None:
    label = label_for(session, user, label_id, Role.editor)
    record(session, label.board_id, user, "label.deleted", label=label.name)
    session.delete(label)
    session.commit()
