"""Workspace routes: list, create with boards, rename, delete (T-720 to T-723; SEC-215)."""

from fastapi import APIRouter
from sqlalchemy.orm import selectinload
from sqlmodel import func, select

from app import limits, workspaces
from app.activity import record
from app.auth import CurrentUser
from app.db import SessionDep
from app.models import Board, BoardMember, Role, Workspace
from app.schemas import board_summary
from app.schemas_organize import (
    BoardMembers,
    MemberBrief,
    WorkspaceCreate,
    WorkspaceCreated,
    WorkspaceOut,
    WorkspaceUpdate,
)
from app.workspaces import board_with_columns, check_board_room, own_workspace

router = APIRouter(prefix="/api", tags=["workspaces"])


def workspace_out(workspace: Workspace) -> WorkspaceOut:
    return WorkspaceOut(id=workspace.id, name=workspace.name, created_at=workspace.created_at)


@router.get("/workspaces")
def list_workspaces(user: CurrentUser, session: SessionDep) -> list[WorkspaceOut]:
    stmt = select(Workspace).where(Workspace.owner_id == user.id).order_by(Workspace.id)
    return [workspace_out(p) for p in session.exec(stmt)]


@router.post("/workspaces", status_code=201)
def create_workspace(
    body: WorkspaceCreate, user: CurrentUser, session: SessionDep
) -> WorkspaceCreated:
    """The workspace and its boards, each with its columns and no cards."""
    count = session.exec(select(func.count()).where(Workspace.owner_id == user.id)).one()
    limits.check(count, workspaces.WORKSPACES_PER_USER, "Limit reached: at most {cap} workspaces")
    if body.boards:
        check_board_room(session, user, len(body.boards))
    workspace = Workspace(owner_id=user.id, name=body.name)
    session.add(workspace)
    session.flush()
    made = []
    for new in body.boards:
        board = board_with_columns(session, user, new.title, new.columns, workspace.id)
        record(session, board.id, user, "board.created", board=board.title)
        made.append(board)
    session.commit()
    return WorkspaceCreated(
        workspace=workspace_out(workspace),
        boards=[board_summary(b, Role.admin, workspace_id=workspace.id) for b in made],
    )


def _members(session, user, workspace_id: int | None) -> list[BoardMembers]:
    """Members of the user's own boards in a workspace (or in none), by board (SEC-217)."""
    stmt = (
        select(Board)
        .where(Board.owner_id == user.id, Board.workspace_id == workspace_id)
        .where(Board.archived_at == None)  # noqa: E711
        .options(selectinload(Board.members).joinedload(BoardMember.user))
        .order_by(Board.created_at, Board.id)
    )
    return [
        BoardMembers(
            board_id=b.id,
            title=b.title,
            members=[MemberBrief(email=m.user.email, role=m.role.value) for m in b.members],
        )
        for b in session.exec(stmt)
    ]


@router.get("/workspaces/none/members")
def loose_board_members(user: CurrentUser, session: SessionDep) -> list[BoardMembers]:
    return _members(session, user, None)


@router.get("/workspaces/{workspace_id}/members")
def workspace_members(
    workspace_id: int, user: CurrentUser, session: SessionDep
) -> list[BoardMembers]:
    own_workspace(session, user, workspace_id)
    return _members(session, user, workspace_id)


@router.patch("/workspaces/{workspace_id}")
def rename_workspace(
    workspace_id: int, body: WorkspaceUpdate, user: CurrentUser, session: SessionDep
) -> WorkspaceOut:
    workspace = own_workspace(session, user, workspace_id)
    workspace.name = body.name
    session.commit()
    return workspace_out(workspace)


@router.delete("/workspaces/{workspace_id}", status_code=204)
def delete_workspace(workspace_id: int, user: CurrentUser, session: SessionDep) -> None:
    """Its boards stay, on their own."""
    session.delete(own_workspace(session, user, workspace_id))
    session.commit()
