"""Per-user resource caps (SEC-42). Read at call time so tests can lower them."""

from fastapi import HTTPException, status

from app.i18n import tr

BOARDS_PER_USER = 50
COLUMNS_PER_BOARD = 20
CARDS_PER_BOARD = 100
ITEMS_PER_CARD = 50
LABELS_PER_BOARD = 30


def check(current: int, cap: int, message: str) -> None:
    """Raise 400 with `message` (a translatable text with `{cap}`) when one more exceeds the cap."""
    if current >= cap:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, tr(message, cap=cap))
