"""Rate limits (SEC-50 to SEC-53, SEC-121, SEC-138) with a swappable counter store.

Counters use fixed time windows. `MemoryStore` keeps them in this process; production
swaps in a Redis store with the same `increment` method (Phase 17). The limits are read
at call time, so tests can change them.
"""

import math
import time
from collections.abc import Callable
from dataclasses import dataclass

from fastapi import HTTPException, Request, status

from app.i18n import tr


@dataclass(frozen=True)
class Limit:
    count: int
    seconds: int


SIGN_IN = Limit(10, 60)  # per IP, shared by sign in and sign up
GUEST = Limit(5, 3600)  # per IP
EMAIL_PER_ADDRESS = Limit(3, 3600)  # forgot password and resend verification
EMAIL_PER_IP = Limit(10, 3600)
AI_PER_MINUTE = Limit(3, 60)  # per user: the whole account has 50 free requests a day
AI_PER_DAY = Limit(10, 86400)
UPLOADS = Limit(20, 60)  # per user
INVITES = Limit(20, 3600)  # per user
ACCESS_REQUESTS = Limit(3, 86400)  # per member per board

TOO_MANY = "Too many attempts. Please wait a moment and try again."
AI_MINUTE = "Too many AI requests. Please wait a minute and try again."
AI_DAY = "You have used today's AI requests. Please try again tomorrow."


class MemoryStore:
    """Counters in this process: key -> (count, expires at)."""

    def __init__(self):
        self.counts: dict[str, tuple[int, float]] = {}

    def increment(self, key: str, expires: float, now: float) -> int:
        self.counts = {k: v for k, v in self.counts.items() if v[1] > now}
        count = self.counts.get(key, (0, expires))[0] + 1
        self.counts[key] = (count, expires)
        return count


class RateLimiter:
    def __init__(self, store: MemoryStore, clock: Callable[[], float] = time.time):
        self.store = store
        self.clock = clock

    def allow(self, key: str, count: int, seconds: int) -> bool:
        """Count one hit for `key`; False when this window already had `count` hits."""
        window = math.floor(self.clock() / seconds)
        hits = self.store.increment(
            f"{key}:{seconds}:{window}", (window + 1) * seconds, self.clock()
        )
        return hits <= count

    def retry_after(self, seconds: int) -> int:
        now = self.clock()
        return math.ceil((math.floor(now / seconds) + 1) * seconds - now)


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def enforce(request: Request, key: str, limit: Limit, message: str = TOO_MANY) -> None:
    """Raise 429 with a translated message and Retry-After when `key` is over `limit`."""
    limiter: RateLimiter = request.app.state.limiter
    if not limiter.allow(key, limit.count, limit.seconds):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            tr(message),
            headers={"Retry-After": str(limiter.retry_after(limit.seconds))},
        )
