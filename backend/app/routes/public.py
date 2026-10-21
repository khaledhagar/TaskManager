"""Public boards: the admin's switch, the read-only link and joining as a Viewer (Phase 20)."""

import secrets

from fastapi import APIRouter, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app import limits, ratelimit
from app.access import board_for, full_board_options, not_found
from app.auth import CurrentUser
from app.db import SessionDep
from app.i18n import tr
from app.models import Board, BoardMember, PublicLink, Role
from app.schemas import (
    BoardSummary,
    PublicBoardOut,
    Strict,
    board_summary,
    public_board_out,
    public_url,
)
from app.sharing import member_count, membership

router = APIRouter(prefix="/api", tags=["public"])
NOINDEX = {"X-Robots-Tag": "noindex"}


class VisibilityIn(Strict):
    public: bool


class VisibilityOut(BaseModel):
    public: bool
    link: str | None


@router.put("/boards/{board_id}/visibility")
def set_visibility(
    board_id: int, body: VisibilityIn, request: Request, user: CurrentUser, session: SessionDep
) -> VisibilityOut:
    """Public creates a new random link; private deletes it, so the old link stops working."""
    board = board_for(session, user, board_id, Role.admin)
    if board.public_link:
        session.delete(board.public_link)
        session.flush()
    link = None
    if body.public:
        token = secrets.token_urlsafe(32)
        session.add(PublicLink(board_id=board_id, token=token))
        link = public_url(request.app.state.settings.app_url, token)
    session.commit()
    return VisibilityOut(public=body.public, link=link)


def _public_board(session: Session, request: Request, token: str, full: bool = False) -> Board:
    ratelimit.enforce(request, f"public:{ratelimit.client_ip(request)}", ratelimit.PUBLIC_VIEWS)
    stmt = select(Board).join(PublicLink).where(PublicLink.token == token)
    if full:
        stmt = stmt.options(*full_board_options())
    board = session.exec(stmt).first()
    if board is None:
        raise not_found()
    return board


@router.get("/public/boards/{token}")
def view_public_board(
    token: str, request: Request, response: Response, session: SessionDep
) -> PublicBoardOut:
    """Read-only, no sign-in: no board id, members, attachments or AI (SEC-171)."""
    response.headers.update(NOINDEX)
    return public_board_out(_public_board(session, request, token, full=True))


@router.get("/public/boards/{token}/background")
def public_background(token: str, request: Request, session: SessionDep) -> Response:
    board = _public_board(session, request, token)
    data = request.app.state.storage.get(board.background_key) if board.background_key else None
    if data is None:
        raise not_found()
    headers = {**NOINDEX, "X-Content-Type-Options": "nosniff", "Cache-Control": "no-cache"}
    return Response(data, media_type="image/webp", headers=headers)


@router.post("/public/boards/{token}/join")
def join_public_board(
    token: str, request: Request, user: CurrentUser, session: SessionDep
) -> BoardSummary:
    """A signed-in visitor becomes a Viewer; members keep their role."""
    board = _public_board(session, request, token)
    if user.is_guest:
        raise HTTPException(status.HTTP_403_FORBIDDEN, tr("Create an account to join this board."))
    member = membership(session, board.id, user.id)
    if member is None:
        limits.check(
            member_count(session, board.id),
            limits.MEMBERS_PER_BOARD,
            "Limit reached: at most {cap} members per board",
        )
        member = BoardMember(board_id=board.id, user_id=user.id, role=Role.viewer)
        session.add(member)
        session.commit()
    return board_summary(board, member.role)
