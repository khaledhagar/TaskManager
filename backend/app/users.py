"""User lookups, creation and guest cleanup."""

from datetime import UTC, datetime, timedelta

from sqlmodel import Session, select

from app.i18n import current_language
from app.models import User
from app.seed import build_board

GUEST_MAX_AGE = timedelta(days=7)


def find_by_email(session: Session, email: str) -> User | None:
    return session.exec(select(User).where(User.email == email)).first()


def find_by_google_id(session: Session, google_id: str) -> User | None:
    return session.exec(select(User).where(User.google_id == google_id)).first()


def create_user(
    session: Session,
    email: str | None,
    password_hash: str | None,
    *,
    verified: bool = False,
    google_id: str | None = None,
) -> User:
    """Create a user (guest when email is None) with the demo board."""
    user = User(
        email=email,
        password_hash=password_hash,
        is_guest=email is None,
        email_verified=verified,
        google_id=google_id,
        language=current_language(),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    build_board(session, user.id, "demo")
    return user


def cleanup_guests(session: Session, max_age: timedelta = GUEST_MAX_AGE) -> int:
    """Delete guest users older than `max_age` with all their data. Returns the count."""
    cutoff = datetime.now(UTC) - max_age
    old = session.exec(select(User).where(User.is_guest, User.created_at < cutoff)).all()
    for user in old:
        session.delete(user)
    session.commit()
    return len(old)
