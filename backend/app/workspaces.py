"""Workspaces: private groups of boards, and boards that start with chosen columns (Phase 26)."""

from sqlmodel import Session, func, select

from app import limits
from app.access import not_found
from app.models import Board, User, Workspace
from app.seed import build_from_data

WORKSPACES_PER_USER = 20


def own_workspace(session: Session, user: User, workspace_id: int) -> Workspace:
    """Workspaces are private: anyone else gets 404 (SEC-215)."""
    workspace = session.get(Workspace, workspace_id)
    if workspace is None or workspace.owner_id != user.id:
        raise not_found()
    return workspace


def own_workspace_ids(session: Session, user: User) -> set[int]:
    return set(session.exec(select(Workspace.id).where(Workspace.owner_id == user.id)))


def check_board_room(session: Session, user: User, new: int = 1) -> None:
    """The board limit counts every board about to be made."""
    count = session.exec(select(func.count()).where(Board.owner_id == user.id)).one()
    limits.check(count + new - 1, limits.BOARDS_PER_USER, "Limit reached: at most {cap} boards")


def board_with_columns(
    session: Session, user: User, title: str, columns: list[str], workspace_id: int | None = None
) -> Board:
    """A board with these columns and no cards."""
    data = {"title": title, "columns": [{"title": c, "cards": []} for c in columns]}
    board = build_from_data(session, user.id, data)
    board.workspace_id = workspace_id
    return board
