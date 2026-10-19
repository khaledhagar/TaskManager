"""Authentication: sign up, sign in, guests, upgrade, delete account (T-020 to T-037)."""

import base64
import json
from datetime import UTC, datetime, timedelta

import pytest
from sqlmodel import Session, select

from app.config import Settings, load_settings
from app.models import Board, User
from app.security import COOKIE, create_token
from app.users import cleanup_guests

CREDS = {"email": "Alice@Example.com", "password": "correct-horse"}


def signup(client, creds=CREDS):
    return client.post("/api/auth/signup", json=creds)


def boards_of(client, email):
    with Session(client.app.state.engine) as s:
        user = s.exec(select(User).where(User.email == email)).one()
        return s.exec(select(Board).where(Board.owner_id == user.id)).all()


def test_signup_creates_user_with_demo_board(client):
    r = signup(client)
    assert r.status_code == 201
    assert r.json() == {"id": 1, "email": "alice@example.com", "is_guest": False}
    assert COOKIE in r.cookies
    assert [b.title for b in boards_of(client, "alice@example.com")] == ["Website Launch"]


def test_signup_duplicate_email(client):
    signup(client)
    r = signup(client, {**CREDS, "email": "alice@example.com"})
    assert r.status_code == 409


@pytest.mark.parametrize(
    "body",
    [
        {"email": "not-an-email", "password": "correct-horse"},
        {"email": "a@example.com", "password": "short"},
        {"email": "a@example.com", "password": "x" * 129},
        {"email": "a@example.com"},
    ],
)
def test_signup_validation(client, body):
    assert signup(client, body).status_code == 422


def test_password_is_hashed(client):
    signup(client)
    with Session(client.app.state.engine) as s:
        user = s.exec(select(User)).one()
    assert user.password_hash.startswith("$argon2")
    assert CREDS["password"] not in user.password_hash


def test_signin_is_case_insensitive_and_sets_cookie(client):
    signup(client)
    client.cookies.clear()
    r = client.post("/api/auth/signin", json={**CREDS, "email": "ALICE@example.COM"})
    assert r.status_code == 200
    assert COOKIE in r.cookies
    assert client.get("/api/auth/me").json()["email"] == "alice@example.com"


def test_signin_failures_look_the_same(client):
    signup(client)
    client.cookies.clear()
    wrong = client.post("/api/auth/signin", json={**CREDS, "password": "wrong-password"})
    unknown = client.post("/api/auth/signin", json={**CREDS, "email": "bob@example.com"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()


def test_guest_gets_demo_board(client):
    r = client.post("/api/auth/guest")
    assert r.status_code == 201
    assert r.json()["is_guest"] is True
    assert r.json()["email"] is None
    with Session(client.app.state.engine) as s:
        assert len(s.exec(select(Board)).all()) == 1


def test_me_requires_cookie(client):
    assert client.get("/api/auth/me").status_code == 401


def test_expired_token_rejected(client, settings):
    signup(client)
    token = create_token(1, settings.jwt_secret, expires_in=timedelta(seconds=-1))
    client.cookies.set(COOKIE, token)
    assert client.get("/api/auth/me").status_code == 401


def test_tampered_token_rejected(client):
    signup(client)
    token = client.cookies[COOKIE]
    client.cookies.set(COOKIE, token[:-2] + ("AA" if token[-2:] != "AA" else "BB"))
    assert client.get("/api/auth/me").status_code == 401


def test_alg_none_token_rejected(client):
    signup(client)

    def b64(d):
        return base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b"=").decode()

    exp = int((datetime.now(UTC) + timedelta(days=1)).timestamp())
    forged = f"{b64({'alg': 'none', 'typ': 'JWT'})}.{b64({'sub': '1', 'exp': exp})}."
    client.cookies.set(COOKIE, forged)
    assert client.get("/api/auth/me").status_code == 401


def test_token_for_wrong_secret_rejected(client):
    signup(client)
    client.cookies.set(COOKIE, create_token(1, "y" * 64))
    assert client.get("/api/auth/me").status_code == 401


def test_signout_clears_cookie(client):
    signup(client)
    r = client.post("/api/auth/signout")
    assert r.status_code == 204
    assert client.get("/api/auth/me").status_code == 401


def test_cookie_flags(client):
    header = signup(client).headers["set-cookie"].lower()
    assert "httponly" in header
    assert "samesite=lax" in header
    assert "path=/" in header
    assert "secure" not in header


def test_cookie_secure_in_production(dist, tmp_path):
    from fastapi.testclient import TestClient

    from app.factory import create_app

    settings = Settings(
        jwt_secret="x" * 64,
        env="production",
        frontend_dist=dist,
        database_url=f"sqlite:///{tmp_path / 'prod.db'}",
    )
    app = create_app(settings)
    with TestClient(app, base_url="https://testserver") as c:
        assert "secure" in signup(c).headers["set-cookie"].lower()
    app.state.engine.dispose()


def test_token_never_in_body(client):
    r = signup(client)
    token = r.cookies[COOKIE]
    assert token not in r.text
    assert token not in client.get("/api/auth/me").text


def test_guest_upgrade_keeps_boards(client):
    client.post("/api/auth/guest")
    r = client.post("/api/auth/upgrade", json=CREDS)
    assert r.status_code == 200
    assert r.json()["is_guest"] is False
    assert len(boards_of(client, "alice@example.com")) == 1
    client.cookies.clear()
    assert client.post("/api/auth/signin", json=CREDS).status_code == 200


def test_upgrade_rules(client):
    signup(client)
    assert client.post("/api/auth/upgrade", json=CREDS).status_code == 400
    client.cookies.clear()
    client.post("/api/auth/guest")
    assert client.post("/api/auth/upgrade", json=CREDS).status_code == 409


def test_upgrade_requires_session(client):
    assert client.post("/api/auth/upgrade", json=CREDS).status_code == 401


def test_delete_account_removes_data(client):
    signup(client)
    assert client.delete("/api/auth/me").status_code == 204
    assert client.get("/api/auth/me").status_code == 401
    assert client.post("/api/auth/signin", json=CREDS).status_code == 401
    with Session(client.app.state.engine) as s:
        assert s.exec(select(Board)).all() == []


def test_cleanup_removes_only_old_guests(session):
    old = datetime.now(UTC) - timedelta(days=8)
    session.add_all(
        [
            User(is_guest=True, created_at=old),
            User(is_guest=True),
            User(email="old@example.com", password_hash="x", created_at=old),
        ]
    )
    session.commit()
    assert cleanup_guests(session) == 1
    remaining = {(u.id, u.is_guest) for u in session.exec(select(User)).all()}
    assert remaining == {(2, True), (3, False)}


def test_missing_jwt_secret_fails(monkeypatch):
    monkeypatch.delenv("JWT_SECRET")
    with pytest.raises(KeyError):
        load_settings()


def test_short_jwt_secret_fails():
    with pytest.raises(ValueError):
        Settings(jwt_secret="short")
