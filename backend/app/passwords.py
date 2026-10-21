"""Password strength rules (SEC-150 to SEC-152), mirrored in `frontend/src/auth/strength.ts`.

Both sides are checked against `tests/password_cases.json`, so keep them identical.
"""

import re
from pathlib import Path
from typing import Literal

from fastapi import HTTPException, status

from app.i18n import tr

Strength = Literal["weak", "medium", "strong"]

COMMON = frozenset((Path(__file__).parent / "common_passwords.txt").read_text().split())
KINDS = (re.compile("[a-z]"), re.compile("[A-Z]"), re.compile("[0-9]"), re.compile("[^a-zA-Z0-9]"))
WEAK_MESSAGE = (
    "This password is too weak. Use at least 10 characters with letters and numbers, "
    "and avoid common words and your email."
)


def strength(password: str, email: str = "") -> Strength:
    """Rate a password as weak, medium or strong."""
    length = len(password)
    kinds = sum(1 for kind in KINDS if kind.search(password))
    name = email.split("@")[0].lower()
    if (
        length < 8
        or password.lower() in COMMON
        or (len(name) >= 4 and name in password.lower())
        or len(set(password)) < 5
    ):
        return "weak"
    if (length >= 12 and kinds >= 3) or (length >= 16 and kinds >= 2):
        return "strong"
    if (length >= 10 and kinds >= 2) or (length >= 8 and kinds >= 3):
        return "medium"
    return "weak"


def require_not_weak(password: str, email: str | None) -> None:
    """Refuse a weak new password with a translated 422."""
    if strength(password, email or "") == "weak":
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, tr(WEAK_MESSAGE))
