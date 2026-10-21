"""Membership-checked lookups (SEC-160, SEC-161).

A user reaches a board only through their `board_members` row: no row means 404 (ids are not
confirmed), and a role below what the action needs means 403 with a message saying whom to ask.
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import joinedload, selectinload
from sqlmodel import Session, select

from app.i18n import tr
from app.models import Board, BoardColumn, BoardMember, Card, ChecklistItem, Label, Role, User

RANK = {Role.viewer: 0, Role.updater: 1, Role.editor: 2, Role.admin: 3}
VIEW_ONLY = "You can only view this board. Ask the board admin for permission to edit."
FULL_ACCESS = "Ask the board admin for full access to do this."
ADMIN_ONLY = "Only the board admin can do this."


def not_found() -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, tr("Not found"))


def require(role: Role, need: Role) -> None:
    """Raise 403 with the right message when `role` is below `need`."""
    if RANK[role] >= RANK[need]:
        return
    message = (
        ADMIN_ONLY if need == Role.admin else VIEW_ONLY if role == Role.viewer else FULL_ACCESS
    )
    raise HTTPException(status.HTTP_403_FORBIDDEN, tr(message))


def _allowed(session: Session, stmt, user: User, need: Role):
    """Run `stmt` (selecting an object and the member's role) for `user`; check the role."""
    row = session.exec(stmt.where(BoardMember.user_id == user.id)).first()
    if row is None:
        raise not_found()
    obj, role = row
    require(role, need)
    return obj


def board_role(session: Session, user: User, board_id: int) -> Role:
    """The user's role on the board; 404 for non-members."""
    stmt = select(BoardMember.role).where(
        BoardMember.board_id == board_id, BoardMember.user_id == user.id
    )
    role = session.exec(stmt).first()
    if role is None:
        raise not_found()
    return role


def board_for(session: Session, user: User, board_id: int, need: Role = Role.viewer) -> Board:
    stmt = select(Board, BoardMember.role).join(BoardMember).where(Board.id == board_id)
    return _allowed(session, stmt, user, need)


def full_board_options():
    """Load columns, cards and their details in a few queries, whatever the size (NFR-01)."""
    cards = selectinload(Board.columns).selectinload(BoardColumn.cards)
    return (
        selectinload(Board.labels),
        selectinload(Board.members).joinedload(BoardMember.user),
        joinedload(Board.public_link),
        joinedload(Board.meeting_link),
        cards.selectinload(Card.labels),
        cards.selectinload(Card.checklist),
        cards.selectinload(Card.attachments),
        cards.selectinload(Card.assignees),
        cards.selectinload(Card.focus_sessions),
    )


def board_full_for(session: Session, user: User, board_id: int) -> Board:
    stmt = (
        select(Board, BoardMember.role)
        .join(BoardMember, BoardMember.board_id == Board.id)
        .where(Board.id == board_id)
        .options(*full_board_options())
    )
    return _allowed(session, stmt, user, Role.viewer)


def column_for(session: Session, user: User, column_id: int, need: Role) -> BoardColumn:
    stmt = (
        select(BoardColumn, BoardMember.role)
        .join(BoardMember, BoardMember.board_id == BoardColumn.board_id)
        .where(BoardColumn.id == column_id)
    )
    return _allowed(session, stmt, user, need)


def card_for(session: Session, user: User, card_id: int, need: Role) -> Card:
    stmt = (
        select(Card, BoardMember.role)
        .join(BoardColumn)
        .join(BoardMember, BoardMember.board_id == BoardColumn.board_id)
        .where(Card.id == card_id)
    )
    return _allowed(session, stmt, user, need)


def item_for(session: Session, user: User, item_id: int, need: Role) -> ChecklistItem:
    stmt = (
        select(ChecklistItem, BoardMember.role)
        .join(Card)
        .join(BoardColumn)
        .join(BoardMember, BoardMember.board_id == BoardColumn.board_id)
        .where(ChecklistItem.id == item_id)
    )
    return _allowed(session, stmt, user, need)


def label_for(session: Session, user: User, label_id: int, need: Role) -> Label:
    stmt = (
        select(Label, BoardMember.role)
        .join(BoardMember, BoardMember.board_id == Label.board_id)
        .where(Label.id == label_id)
    )
    return _allowed(session, stmt, user, need)


def board_labels(session: Session, board_id: int, label_ids: list[int]) -> list[Label]:
    """Return the labels with these ids, all of which must belong to the board."""
    ids = set(label_ids)
    stmt = select(Label).where(Label.board_id == board_id, Label.id.in_(ids))
    labels = session.exec(stmt).all()
    if len(labels) != len(ids):
        raise not_found()
    return list(labels)


def renumber(items: list) -> None:
    """Set `position` to the list index for every item."""
    for i, item in enumerate(items):
        item.position = i
