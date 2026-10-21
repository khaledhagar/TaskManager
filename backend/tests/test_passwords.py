"""Password strength (T-500, T-503 to T-505; SEC-150, SEC-152)."""

import json
from pathlib import Path

import pytest
from helpers import PASSWORD, link_token, sign_up
from sqlmodel import Session

from app.models import User
from app.passwords import strength
from app.security import hash_password

CASES = json.loads((Path(__file__).parent / "password_cases.json").read_text(encoding="utf-8"))
WEAK = "abcdefghij"
WEAK_MESSAGE = (
    "This password is too weak. Use at least 10 characters with letters and numbers, "
    "and avoid common words and your email."
)


@pytest.mark.parametrize("case", CASES, ids=[c["password"] for c in CASES])
def test_shared_examples(case):
    assert strength(case["password"], case["email"]) == case["expected"]


def test_common_list_is_lowercase_and_unique():
    words = (Path(__file__).parents[1] / "app" / "common_passwords.txt").read_text().split()
    assert len(words) >= 150
    assert words == [w.lower() for w in words]
    assert len(set(words)) == len(words)


def test_signup_refuses_weak_password(client):
    r = client.post("/api/auth/signup", json={"email": "bob@example.com", "password": WEAK})
    assert r.status_code == 422
    assert r.json()["detail"] == WEAK_MESSAGE


def test_weak_message_in_arabic(client):
    r = client.post(
        "/api/auth/signup",
        json={"email": "bob@example.com", "password": WEAK},
        headers={"Accept-Language": "ar"},
    )
    assert r.status_code == 422
    assert "ضعيفة" in r.json()["detail"]


def test_password_with_email_name_is_refused(client):
    r = client.post(
        "/api/auth/signup", json={"email": "khaled@example.com", "password": "khaled2026!x"}
    )
    assert r.status_code == 422


def test_guest_upgrade_refuses_weak_password(client):
    client.post("/api/auth/guest")
    r = client.post("/api/auth/upgrade", json={"email": "bob@example.com", "password": WEAK})
    assert r.status_code == 422


def test_reset_refuses_weak_password_and_keeps_the_link(client):
    sign_up(client)
    client.post("/api/auth/forgot-password", json={"email": "alice@example.com"})
    token = link_token(client, "/reset-password")
    body = {"token": token, "password": WEAK}
    assert client.post("/api/auth/reset-password", json=body).status_code == 422
    body["password"] = "brand-new-password"
    assert client.post("/api/auth/reset-password", json=body).status_code == 200


def test_change_and_set_password_refuse_weak_password(client):
    sign_up(client)
    body = {"current_password": PASSWORD, "new_password": WEAK}
    assert client.post("/api/auth/change-password", json=body).status_code == 422


def test_sign_in_still_accepts_an_old_weak_password(client):
    with Session(client.app.state.engine) as s:
        s.add(User(email="old@example.com", password_hash=hash_password(WEAK), email_verified=True))
        s.commit()
    r = client.post("/api/auth/signin", json={"email": "old@example.com", "password": WEAK})
    assert r.status_code == 200
