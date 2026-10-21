"""In-app notifications for invitations and for changes to cards you are assigned to (Phase 26).

Card changes reach only current members assigned to the card, never the person who made the
change; one entry per card and person within 10 minutes (SEC-217). Neither sends email.
"""

from datetime import timedelta

from sqlalchemy import delete
from sqlmodel import Session, select

from app.models import Board, BoardInvite, BoardMember, Card, CardAssignee, User, utcnow
from app.models_notify import Notification

CHANGES = {
    "card.moved",
    "card.completed",
    "card.reopened",
    "card.edited",
    "card.renamed",
    "card.labels",
    "card.archived",
    "card.restored",
    "checklist.checked",
    "checklist.unchecked",
    "comment.added",
}
WINDOW = timedelta(minutes=10)


def card_changed(session: Session, board_id: int, actor: User, kind: str, card: Card) -> None:
    if kind not in CHANGES:
        return
    people = session.exec(
        select(CardAssignee.user_id)
        .join(
            BoardMember,
            (BoardMember.user_id == CardAssignee.user_id) & (BoardMember.board_id == board_id),
        )
        .where(CardAssignee.card_id == card.id, CardAssignee.user_id != actor.id)
    ).all()
    if not people:
        return
    board = session.get(Board, board_id)
    data = {"title": card.title, "board": board.title, "change": kind}
    for user_id in people:
        recent = session.exec(
            select(Notification).where(
                Notification.user_id == user_id,
                Notification.card_id == card.id,
                Notification.actor_id == actor.id,
                Notification.kind == "card_changed",
                Notification.read_at == None,  # noqa: E711
                Notification.created_at >= utcnow() - WINDOW,
            )
        ).first()
        if recent:
            recent.data = data
            session.add(recent)
        else:
            session.add(
                Notification(
                    user_id=user_id,
                    kind="card_changed",
                    board_id=board_id,
                    card_id=card.id,
                    actor_id=actor.id,
                    data=data,
                )
            )


def _invitee(session: Session, email: str) -> User | None:
    return session.exec(select(User).where(User.email == email)).first()


def drop_invited(session: Session, invite: BoardInvite) -> None:
    """Remove the invitation's notification (resent, cancelled)."""
    person = _invitee(session, invite.email)
    if person:
        session.execute(
            delete(Notification).where(
                Notification.user_id == person.id,
                Notification.board_id == invite.board_id,
                Notification.kind == "invited",
            )
        )


def invited(session: Session, invite: BoardInvite, inviter: User, board: Board, path: str) -> None:
    """When the invited address has an account: a notification that opens the invitation."""
    person = _invitee(session, invite.email)
    if person is None:
        return
    drop_invited(session, invite)
    session.add(
        Notification(
            user_id=person.id,
            kind="invited",
            board_id=board.id,
            actor_id=inviter.id,
            data={"board": board.title, "path": path},
        )
    )


def invitation_used(session: Session, board_id: int, user: User) -> None:
    """Joining the board removes its invitation notification (a removed member sees nothing)."""
    session.execute(
        delete(Notification).where(
            Notification.user_id == user.id,
            Notification.board_id == board_id,
            Notification.kind == "invited",
        )
    )
