"""Delete stored files when their rows go away, but only after the transaction commits.

Covers every path (card, column, board, account, guest cleanup) because ORM cascades
delete each Attachment and Board row individually. Sessions carry the storage in
`session.info["storage"]`.
"""

from sqlalchemy import event
from sqlalchemy.orm import Session, object_session

from app.models import Attachment, Board


def discard(session: Session, key: str | None) -> None:
    """Queue a storage key for deletion when `session` commits."""
    if key:
        session.info.setdefault("discard", []).append(key)


@event.listens_for(Attachment, "after_delete")
def _attachment_deleted(_mapper, _connection, target: Attachment) -> None:
    discard(object_session(target), target.storage_key)


@event.listens_for(Board, "after_delete")
def _board_deleted(_mapper, _connection, target: Board) -> None:
    discard(object_session(target), target.background_key)


@event.listens_for(Session, "after_commit")
def _after_commit(session: Session) -> None:
    keys = session.info.pop("discard", [])
    storage = session.info.get("storage")
    if storage is not None:
        for key in keys:
            storage.delete(key)


@event.listens_for(Session, "after_rollback")
def _after_rollback(session: Session) -> None:
    session.info.pop("discard", None)
