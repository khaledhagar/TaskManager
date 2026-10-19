"""Password hashing and session tokens."""

from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash

COOKIE = "session"
TOKEN_TTL = timedelta(days=7)
ALGORITHM = "HS256"

_hasher = PasswordHash.recommended()
_DUMMY_HASH = _hasher.hash("timing-equalizer")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    """Check a password; hashes a dummy when there is no user to keep timing equal."""
    if password_hash is None:
        _hasher.verify(password, _DUMMY_HASH)
        return False
    return _hasher.verify(password, password_hash)


def create_token(user_id: int, secret: str, expires_in: timedelta = TOKEN_TTL) -> str:
    now = datetime.now(UTC)
    payload = {"sub": str(user_id), "iat": now, "exp": now + expires_in}
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


def read_token(token: str, secret: str) -> int | None:
    """Return the user id from a valid token, or None."""
    try:
        payload = jwt.decode(
            token, secret, algorithms=[ALGORITHM], options={"require": ["exp", "sub"]}
        )
        return int(payload["sub"])
    except (jwt.InvalidTokenError, ValueError):
        return None
