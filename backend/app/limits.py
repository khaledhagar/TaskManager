"""Per-user resource caps (SEC-42). Read at call time so tests can lower them."""

from fastapi import HTTPException, status

BOARDS_PER_USER = 50
COLUMNS_PER_BOARD = 20
CARDS_PER_BOARD = 500
ITEMS_PER_CARD = 50
LABELS_PER_BOARD = 30


def check(current: int, cap: int, what: str) -> None:
    """Raise 400 when adding one more would exceed the cap."""
    if current >= cap:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Limit reached: at most {cap} {what}")
