"""Board members and access requests (Phase 18)."""

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app import ratelimit
from app.access import RANK, board_for, board_role, not_found
from app.auth import CurrentUser
from app.db import SessionDep
from app.i18n import tr
from app.mailer import access_email
from app.models import AccessRequest, Board, BoardColumn, BoardMember, Card, CardAssignee, Role
from app.schemas import Strict
from app.sharing import board_link, membership, pending_invites

router = APIRouter(prefix="/api", tags=["members"])


class MemberOut(BaseModel):
    user_id: int
    email: str | None
    role: Role


class InviteOut(BaseModel):
    id: int
    email: str
    expires_at: datetime


class RequestOut(BaseModel):
    id: int
    user_id: int
    email: str | None
    role: Role
    created_at: datetime


class MembersOut(BaseModel):
    role: Role
    members: list[MemberOut]
    invites: list[InviteOut]
    requests: list[RequestOut]
    requested: bool


class RoleIn(Strict):
    role: Literal[Role.viewer, Role.updater, Role.editor]


class ApproveIn(Strict):
    role: Literal[Role.updater, Role.editor]


class RequestCreated(BaseModel):
    id: int


def member_out(member: BoardMember) -> MemberOut:
    return MemberOut(user_id=member.user_id, email=member.user.email, role=member.role)


def _drop_request(session: Session, board_id: int, user_id: int) -> None:
    stmt = select(AccessRequest).where(
        AccessRequest.board_id == board_id, AccessRequest.user_id == user_id
    )
    for request in session.exec(stmt):
        session.delete(request)


@router.get("/boards/{board_id}/members")
def list_members(board_id: int, user: CurrentUser, session: SessionDep) -> MembersOut:
    role = board_role(session, user, board_id)
    board = session.exec(
        select(Board)
        .where(Board.id == board_id)
        .options(
            selectinload(Board.members).selectinload(BoardMember.user),
            selectinload(Board.access_requests).selectinload(AccessRequest.user),
        )
    ).one()
    admin = role == Role.admin
    roles = {m.user_id: m.role for m in board.members}
    members = sorted(board.members, key=lambda m: (m.role != Role.admin, m.id))
    return MembersOut(
        role=role,
        members=[member_out(m) for m in members],
        invites=[
            InviteOut(id=i.id, email=i.email, expires_at=i.expires_at)
            for i in (pending_invites(session, board_id) if admin else [])
        ],
        requests=[
            RequestOut(
                id=r.id,
                user_id=r.user_id,
                email=r.user.email,
                role=roles[r.user_id],
                created_at=r.created_at,
            )
            for r in (board.access_requests if admin else [])
        ],
        requested=any(r.user_id == user.id for r in board.access_requests),
    )


@router.patch("/boards/{board_id}/members/{user_id}")
def change_role(
    board_id: int, user_id: int, body: RoleIn, user: CurrentUser, session: SessionDep
) -> MemberOut:
    board_for(session, user, board_id, Role.admin)
    member = membership(session, board_id, user_id)
    if member is None:
        raise not_found()
    if member.role == Role.admin:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, tr("The board admin's role cannot be changed.")
        )
    member.role = body.role
    _drop_request(session, board_id, user_id)
    session.commit()
    return member_out(member)


@router.delete("/boards/{board_id}/members/{user_id}", status_code=204)
def remove_member(board_id: int, user_id: int, user: CurrentUser, session: SessionDep) -> None:
    """The admin removes a member, or a member leaves (removes themselves)."""
    if user_id == user.id:
        if board_role(session, user, board_id) == Role.admin:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, tr("The board admin cannot leave the board.")
            )
    else:
        board_for(session, user, board_id, Role.admin)
    member = membership(session, board_id, user_id)
    if member is None:
        raise not_found()
    _drop_request(session, board_id, user_id)
    assigned = (
        select(CardAssignee)
        .join(Card)
        .join(BoardColumn)
        .where(BoardColumn.board_id == board_id, CardAssignee.user_id == user_id)
    )
    for row in session.exec(assigned):
        session.delete(row)
    session.delete(member)
    session.commit()


@router.post("/boards/{board_id}/access-requests", status_code=201)
def request_access(
    board_id: int, request: Request, user: CurrentUser, session: SessionDep
) -> RequestCreated:
    """Ask the admin for more access; the admin gets one email per pending request."""
    if RANK[board_role(session, user, board_id)] >= RANK[Role.editor]:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, tr("You already have full access to this board.")
        )
    stmt = select(AccessRequest).where(
        AccessRequest.board_id == board_id, AccessRequest.user_id == user.id
    )
    existing = session.exec(stmt).first()
    if existing:
        return RequestCreated(id=existing.id)
    ratelimit.enforce(request, f"access:{user.id}:{board_id}", ratelimit.ACCESS_REQUESTS)
    access = AccessRequest(board_id=board_id, user_id=user.id)
    session.add(access)
    session.commit()
    board = session.get(Board, board_id)
    if board.owner.email:
        link = board_link(request.app.state.settings.app_url, board_id)
        request.app.state.mailer.send(
            access_email(board.owner.email, user.email, board.title, link)
        )
    return RequestCreated(id=access.id)


def _admin_request(session: Session, user, request_id: int) -> AccessRequest:
    access = session.get(AccessRequest, request_id)
    if access is None:
        raise not_found()
    board_for(session, user, access.board_id, Role.admin)
    return access


@router.post("/access-requests/{request_id}/approve")
def approve_request(
    request_id: int, body: ApproveIn, user: CurrentUser, session: SessionDep
) -> MemberOut:
    access = _admin_request(session, user, request_id)
    member = membership(session, access.board_id, access.user_id)
    member.role = body.role
    session.delete(access)
    session.commit()
    return member_out(member)


@router.delete("/access-requests/{request_id}", status_code=204)
def decline_request(request_id: int, user: CurrentUser, session: SessionDep) -> None:
    session.delete(_admin_request(session, user, request_id))
    session.commit()
