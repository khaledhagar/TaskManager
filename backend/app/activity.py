"""Board activity log (Phase 22): one short entry per change, newest 1,000 kept per board.

Entries hold the kind of change and short details (titles, column names, emails of members),
never card descriptions or comment text (SEC-205). The browser turns them into sentences in the
user's language.
"""

from sqlalchemy import delete
from sqlmodel import Session, select

from app.models import Activity, Card, User

KEEP = 1000


def record(
    session: Session,
    board_id: int,
    actor: User | None,
    kind: str,
    card: Card | None = None,
    **data: object,
) -> None:
    """Add an entry for a change; call it before the endpoint commits.

    Also tells the people assigned to the card about someone else's change (Phase 26).
    """
    if card is not None:
        if card.id is None:
            session.flush()
        data.setdefault("title", card.title)
        if actor is not None:
            from app.watch import card_changed

            card_changed(session, board_id, actor, kind, card)
    session.add(
        Activity(
            board_id=board_id,
            card_id=card.id if card else None,
            actor_id=actor.id if actor else None,
            kind=kind,
            data=data,
        )
    )
    session.flush()
    oldest_kept = select(Activity.id).where(Activity.board_id == board_id)
    cutoff = session.exec(oldest_kept.order_by(Activity.id.desc()).offset(KEEP).limit(1)).first()
    if cutoff is not None:
        session.execute(
            delete(Activity).where(Activity.board_id == board_id, Activity.id <= cutoff)
        )
