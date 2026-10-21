"""Issue and consume single-use emailed tokens (verification and password reset)."""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from sqlmodel import Session, select

from app.models import EmailToken, TokenPurpose, User

TTL = {TokenPurpose.verify: timedelta(hours=24), TokenPurpose.reset: timedelta(minutes=30)}


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def issue(session: Session, user: User, purpose: TokenPurpose) -> str:
    """Create a token, retire older unused ones of the same purpose, return the raw value."""
    now = datetime.now(UTC)
    old = session.exec(
        select(EmailToken).where(
            EmailToken.user_id == user.id,
            EmailToken.purpose == purpose,
            EmailToken.used_at == None,  # noqa: E711
        )
    )
    for token in old:
        token.used_at = now
    raw = secrets.token_urlsafe(32)
    session.add(
        EmailToken(
            user_id=user.id, purpose=purpose, token_hash=_hash(raw), expires_at=now + TTL[purpose]
        )
    )
    session.commit()
    return raw


def _valid(session: Session, raw: str, purpose: TokenPurpose) -> EmailToken | None:
    """The token if it exists, is unused and has not expired."""
    token = session.exec(
        select(EmailToken).where(EmailToken.token_hash == _hash(raw), EmailToken.purpose == purpose)
    ).first()
    if token is None or token.used_at is not None:
        return None
    if token.expires_at.replace(tzinfo=UTC) < datetime.now(UTC):
        return None
    return token


def owner(session: Session, raw: str, purpose: TokenPurpose) -> User | None:
    """The user of a valid token, without using it up."""
    token = _valid(session, raw, purpose)
    return session.get(User, token.user_id) if token else None


def consume(session: Session, raw: str, purpose: TokenPurpose) -> User | None:
    """Mark a valid token as used and return its user."""
    token = _valid(session, raw, purpose)
    if token is None:
        return None
    token.used_at = datetime.now(UTC)
    session.commit()
    return session.get(User, token.user_id)
