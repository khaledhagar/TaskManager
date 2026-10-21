"""Rate limits (T-100, T-101, T-102, T-164, SEC-50 to SEC-53, SEC-121, SEC-138)."""

import pytest
from helpers import PASSWORD, FakeLLM, first_board, sign_up

from app import ai
from app.assistant import ChecklistDraft
from app.ratelimit import MemoryStore, RateLimiter

TOO_MANY = "Too many attempts. Please wait a moment and try again."


class Clock:
    """A clock the test moves by hand."""

    def __init__(self):
        self.now = 1_000_000.0

    def __call__(self) -> float:
        return self.now


@pytest.fixture
def clock(client):
    fake = Clock()
    client.app.state.limiter.clock = fake
    return fake


def signin(client, email="nobody@example.com", headers=None):
    body = {"email": email, "password": PASSWORD}
    return client.post("/api/auth/signin", json=body, headers=headers or {})


# --- the limiter itself ---------------------------------------------------------------------------


def test_counts_reset_when_the_window_passes():
    clock = Clock()
    limiter = RateLimiter(MemoryStore(), clock)
    assert [limiter.allow("k", 2, 60) for _ in range(3)] == [True, True, False]
    clock.now += 60
    assert limiter.allow("k", 2, 60)


def test_store_forgets_old_windows():
    clock = Clock()
    store = MemoryStore()
    limiter = RateLimiter(store, clock)
    for i in range(50):
        limiter.allow(f"key{i}", 5, 60)
    clock.now += 120
    limiter.allow("new", 5, 60)
    assert len(store.counts) == 1


# --- T-100 sign in and sign up ------------------------------------------------------------------


def test_11th_sign_in_within_a_minute_is_429(client, clock):
    assert [signin(client).status_code for _ in range(10)] == [401] * 10
    r = signin(client)
    assert r.status_code == 429
    assert r.json()["detail"] == TOO_MANY
    assert 0 < int(r.headers["retry-after"]) <= 60
    clock.now += 60
    assert signin(client).status_code == 401


def test_sign_up_shares_the_sign_in_limit(client, clock):
    for _ in range(10):
        signin(client)
    body = {"email": "new@example.com", "password": PASSWORD}
    assert client.post("/api/auth/signup", json=body).status_code == 429


def test_limit_message_follows_the_language(client, clock):
    for _ in range(10):
        signin(client)
    r = signin(client, headers={"accept-language": "ar"})
    assert r.json()["detail"] == "محاولات كثيرة جدا. انتظر قليلا ثم حاول مرة أخرى."


# --- T-101 guests ---------------------------------------------------------------------------------


def test_6th_guest_within_an_hour_is_429(client, clock):
    assert [client.post("/api/auth/guest").status_code for _ in range(5)] == [201] * 5
    assert client.post("/api/auth/guest").status_code == 429
    clock.now += 3600
    assert client.post("/api/auth/guest").status_code == 201


# --- T-164 emails (SEC-121) ---------------------------------------------------------------------


def test_4th_reset_email_for_one_address_is_429(client, clock):
    body = {"email": "alice@example.com"}
    codes = [client.post("/api/auth/forgot-password", json=body).status_code for _ in range(4)]
    assert codes == [202, 202, 202, 429]
    assert client.post("/api/auth/resend-verification", json=body).status_code == 429


def test_11th_email_request_from_one_ip_is_429(client, clock):
    codes = [
        client.post("/api/auth/forgot-password", json={"email": f"u{i}@example.com"}).status_code
        for i in range(11)
    ]
    assert codes == [202] * 10 + [429]


# --- T-102 AI (SEC-52) ----------------------------------------------------------------------------


def test_ai_allows_3_per_minute_and_10_per_day(client, clock, monkeypatch):
    llm = FakeLLM()
    llm.result = ChecklistDraft(items=["a"])
    monkeypatch.setattr(ai, "complete", llm)
    sign_up(client)
    card = first_board(client)["columns"][0]["cards"][0]
    url = f"/api/ai/cards/{card['id']}/checklist"

    codes = [client.post(url).status_code for _ in range(4)]
    assert codes == [200, 200, 200, 429]
    assert "minute" in client.post(url).json()["detail"]
    for _ in range(2):
        clock.now += 60
        assert [client.post(url).status_code for _ in range(3)] == [200] * 3
    clock.now += 60
    assert client.post(url).status_code == 200  # the 10th call today
    clock.now += 60
    r = client.post(url)
    assert r.status_code == 429
    assert "tomorrow" in r.json()["detail"]
    assert len(llm.calls) == 10


def test_ai_limits_are_per_user(client, clock, monkeypatch):
    llm = FakeLLM()
    llm.result = ChecklistDraft(items=["a"])
    monkeypatch.setattr(ai, "complete", llm)
    for email in ("a@example.com", "b@example.com"):
        sign_up(client, email)
        card = first_board(client)["columns"][0]["cards"][0]
        codes = [client.post(f"/api/ai/cards/{card['id']}/checklist").status_code for _ in range(3)]
        assert codes == [200] * 3


# --- SEC-138 uploads ------------------------------------------------------------------------------


def test_21st_upload_within_a_minute_is_429(client, clock):
    sign_up(client)
    board = first_board(client)
    cards = [c for col in board["columns"] for c in col["cards"]]
    codes = []
    for i in range(21):
        card = cards[i % len(cards)]
        files = {"file": (f"n{i}.txt", b"hi", "text/plain")}
        codes.append(client.post(f"/api/cards/{card['id']}/attachments", files=files).status_code)
    assert codes == [201] * 20 + [429]
