"""Email verification, forgot/reset/change password, mailer (T-140 to T-153, T-161 to T-163)."""

import hashlib
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from helpers import PASSWORD, link_token, outbox, sign_up
from sqlmodel import Session, select

from app import mailer as mailer_module
from app.config import Settings
from app.mailer import Email, Mailer
from app.models import EmailToken, User
from app.security import COOKIE, create_token

EMAIL = "alice@example.com"
NEW_PASSWORD = "brand-new-password"


def signup_unverified(client):
    client.post("/api/auth/signup", json={"email": EMAIL, "password": PASSWORD})


def signin(client, password=PASSWORD):
    return client.post("/api/auth/signin", json={"email": EMAIL, "password": password})


def expire_tokens(client):
    with Session(client.app.state.engine) as s:
        for token in s.exec(select(EmailToken)):
            token.expires_at = datetime.now(UTC) - timedelta(minutes=1)
            s.add(token)
        s.commit()


def forgot(client, email=EMAIL):
    return client.post("/api/auth/forgot-password", json={"email": email})


def reset(client, token, password=NEW_PASSWORD):
    return client.post("/api/auth/reset-password", json={"token": token, "password": password})


# --- verification ---------------------------------------------------------------


def test_unverified_user_cannot_sign_in(client):
    signup_unverified(client)
    r = signin(client)
    assert r.status_code == 403
    assert "verify" in r.json()["detail"].lower()
    assert COOKIE not in r.cookies


def test_verification_link_verifies_and_signs_in(client):
    signup_unverified(client)
    r = client.post("/api/auth/verify", json={"token": link_token(client)})
    assert r.status_code == 200
    assert r.json()["email_verified"] is True
    assert client.get("/api/auth/me").status_code == 200


def test_verification_token_expires_and_is_single_use(client):
    signup_unverified(client)
    token = link_token(client)
    assert client.post("/api/auth/verify", json={"token": token}).status_code == 200
    assert client.post("/api/auth/verify", json={"token": token}).status_code == 400
    client.post("/api/auth/signup", json={"email": "bob@example.com", "password": PASSWORD})
    token = link_token(client)
    expire_tokens(client)
    assert client.post("/api/auth/verify", json={"token": token}).status_code == 400


@pytest.mark.parametrize("token", ["garbage", "", "x" * 500])
def test_unknown_or_tampered_token_rejected(client, token):
    signup_unverified(client)
    assert client.post("/api/auth/verify", json={"token": token}).status_code in (400, 422)


def test_only_token_hash_is_stored(client):
    signup_unverified(client)
    raw = link_token(client)
    with Session(client.app.state.engine) as s:
        stored = s.exec(select(EmailToken)).one()
    assert stored.token_hash == hashlib.sha256(raw.encode()).hexdigest()
    assert raw not in stored.token_hash


def test_resend_verification_is_enumeration_safe(client):
    signup_unverified(client)
    old = link_token(client)
    known = client.post("/api/auth/resend-verification", json={"email": EMAIL})
    sent = len(outbox(client))
    unknown = client.post("/api/auth/resend-verification", json={"email": "nobody@example.com"})
    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json()
    assert len(outbox(client)) == sent
    assert client.post("/api/auth/verify", json={"token": old}).status_code == 400
    assert client.post("/api/auth/verify", json={"token": link_token(client)}).status_code == 200


def test_resend_for_verified_user_sends_nothing(client):
    sign_up(client)
    sent = len(outbox(client))
    assert client.post("/api/auth/resend-verification", json={"email": EMAIL}).status_code == 202
    assert len(outbox(client)) == sent


# --- forgot and reset password ----------------------------------------------------


def test_forgot_password_is_enumeration_safe(client):
    sign_up(client)
    known = forgot(client)
    sent = len(outbox(client))
    unknown = forgot(client, "nobody@example.com")
    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json()
    assert len(outbox(client)) == sent
    assert "/reset-password?token=" in outbox(client)[-1].text


def test_reset_sets_new_password(client):
    sign_up(client)
    forgot(client)
    r = reset(client, link_token(client, "/reset-password"))
    assert r.status_code == 200
    client.cookies.clear()
    assert signin(client).status_code == 401
    assert signin(client, NEW_PASSWORD).status_code == 200


def test_reset_token_expires_and_is_single_use(client):
    sign_up(client)
    forgot(client)
    token = link_token(client, "/reset-password")
    assert reset(client, token).status_code == 200
    assert reset(client, token, "another-password").status_code == 400
    forgot(client)
    token = link_token(client, "/reset-password")
    expire_tokens(client)
    assert reset(client, token).status_code == 400


def test_verify_token_cannot_reset_password(client):
    signup_unverified(client)
    assert reset(client, link_token(client)).status_code == 400


def test_reset_signs_out_other_sessions(client):
    sign_up(client)
    with TestClient(client.app) as other:
        forgot(other)
        assert reset(other, link_token(other, "/reset-password")).status_code == 200
        assert other.get("/api/auth/me").status_code == 200
    assert client.get("/api/auth/me").status_code == 401


def test_reset_password_rules(client):
    sign_up(client)
    forgot(client)
    assert reset(client, link_token(client, "/reset-password"), "short").status_code == 422


def test_reset_verifies_unverified_account(client):
    signup_unverified(client)
    forgot(client)
    assert reset(client, link_token(client, "/reset-password")).status_code == 200
    assert client.get("/api/auth/me").json()["email_verified"] is True


# --- change password --------------------------------------------------------------


def change(client, current, new=NEW_PASSWORD):
    return client.post(
        "/api/auth/change-password", json={"current_password": current, "new_password": new}
    )


def test_change_password_requires_current(client):
    sign_up(client)
    assert change(client, "wrong-password").status_code == 403
    assert change(client, None).status_code == 403
    assert change(client, PASSWORD).status_code == 200
    client.cookies.clear()
    assert signin(client, NEW_PASSWORD).status_code == 200


def test_change_password_keeps_current_session_only(client):
    sign_up(client)
    with TestClient(client.app) as other:
        assert signin(other).status_code == 200
        assert change(client, PASSWORD).status_code == 200
        assert other.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me").status_code == 200


def test_google_only_user_can_set_password(client, settings):
    with Session(client.app.state.engine) as s:
        user = User(email=EMAIL, google_id="g-1", email_verified=True)
        s.add(user)
        s.commit()
        client.cookies.set(COOKIE, create_token(user.id, 0, settings.jwt_secret))
    assert client.get("/api/auth/me").json()["has_password"] is False
    assert change(client, None).status_code == 200
    assert client.get("/api/auth/me").json()["has_password"] is True
    client.cookies.clear()
    assert signin(client, NEW_PASSWORD).status_code == 200


def test_change_password_requires_sign_in(client):
    assert change(client, PASSWORD).status_code == 401


# --- links and mailer ---------------------------------------------------------------


def test_links_use_app_url_not_host_header(client, settings):
    client.post(
        "/api/auth/signup",
        json={"email": EMAIL, "password": PASSWORD},
        headers={"host": "evil.example"},
    )
    assert f"{settings.app_url}/verify?token=" in outbox(client)[-1].text
    assert "evil.example" not in outbox(client)[-1].text


def test_smtp_mailer_uses_starttls_and_login(monkeypatch):
    calls = []

    class FakeSMTP:
        def __init__(self, host, port, timeout):
            calls.append(("connect", host, port))

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def starttls(self):
            calls.append(("starttls",))

        def login(self, user, password):
            calls.append(("login", user, password))

        def send_message(self, message):
            calls.append(("send", message["To"], message["Subject"]))

    monkeypatch.setattr(mailer_module.smtplib, "SMTP", FakeSMTP)
    settings = Settings(
        jwt_secret="x" * 64, email_mode="smtp", smtp_user="me@gmail.com", smtp_password="app-pw"
    )
    mailer = Mailer(settings)
    mailer.send(Email(to="a@example.com", subject="Hi", text="Body"))
    assert calls == [
        ("connect", "smtp.gmail.com", 587),
        ("starttls",),
        ("login", "me@gmail.com", "app-pw"),
        ("send", "a@example.com", "Hi"),
    ]
    assert mailer.outbox == []


def test_reset_email_content(client):
    sign_up(client)
    forgot(client)
    text = outbox(client)[-1].text
    assert PASSWORD not in text
    assert "did not ask" in text
    assert "30 minutes" in text


def test_invalid_email_mode_rejected():
    with pytest.raises(ValueError):
        Settings(jwt_secret="x" * 64, email_mode="carrier-pigeon")
