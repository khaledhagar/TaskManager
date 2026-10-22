"""Google sign-in with a faked Google identity (T-154 to T-160)."""

from dataclasses import replace
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient
from helpers import first_board, sign_up
from sqlmodel import Session, select

from app import google
from app.factory import create_app
from app.models import User
from app.security import COOKIE


@pytest.fixture
def gclient(settings):
    app = create_app(replace(settings, google_client_id="cid", google_client_secret="csecret"))
    with TestClient(app, follow_redirects=False) as c:
        yield c
    app.state.engine.dispose()


@pytest.fixture
def identity(monkeypatch):
    """Make Google's callback return this identity (mutable per test)."""
    ident = google.Identity(sub="g-123", email="alice@example.com", email_verified=True)
    state = {"identity": ident}

    async def fake_fetch(request):
        return state["identity"]

    monkeypatch.setattr(google, "fetch_identity", fake_fetch)
    return state


def callback(c):
    return c.get("/api/auth/google/callback?code=abc&state=xyz")


def users(c):
    with Session(c.app.state.engine) as s:
        return s.exec(select(User)).all()


def test_config_reports_google(client, gclient):
    assert client.get("/api/auth/config").json() == {"google": False}
    assert gclient.get("/api/auth/config").json() == {"google": True}


def test_login_404_when_not_configured(client):
    assert client.get("/api/auth/google/login", follow_redirects=False).status_code == 404


def test_login_redirects_with_state_and_pkce(gclient, settings):
    r = gclient.get("/api/auth/google/login")
    assert r.status_code == 302
    url = urlparse(r.headers["location"])
    q = {k: v[0] for k, v in parse_qs(url.query).items()}
    assert (
        f"{url.scheme}://{url.netloc}{url.path}" == "https://accounts.google.com/o/oauth2/v2/auth"
    )
    assert q["client_id"] == "cid"
    assert q["redirect_uri"] == f"{settings.app_url}/api/auth/google/callback"
    assert q["scope"] == "openid email profile"
    assert q["code_challenge_method"] == "S256"
    assert len(q["code_challenge"]) >= 43
    assert len(q["state"]) >= 20
    assert q["nonce"]


def test_callback_with_bad_state_is_rejected(gclient, settings):
    gclient.get("/api/auth/google/login")
    r = callback(gclient)
    assert r.status_code == 302
    assert r.headers["location"] == f"{settings.app_url}/signin?error=google"
    assert COOKIE not in r.cookies
    assert users(gclient) == []


def test_callback_creates_verified_user(gclient, identity, settings):
    r = callback(gclient)
    assert r.status_code == 302
    assert r.headers["location"] == f"{settings.app_url}/"  # T-801: the start page
    me = gclient.get("/api/auth/me").json()
    assert me["email"] == "alice@example.com"
    assert me["email_verified"] and me["google_linked"] and not me["has_password"]
    assert first_board(gclient)["title"] == "Website Launch"


def test_callback_signs_in_existing_google_user(gclient, identity, settings):
    callback(gclient)
    gclient.cookies.clear()
    r = callback(gclient)
    assert r.headers["location"] == f"{settings.app_url}/"
    assert gclient.get("/api/auth/me").status_code == 200
    assert len(users(gclient)) == 1


def test_callback_links_existing_password_account(gclient, identity):
    sign_up(gclient)
    gclient.cookies.clear()
    callback(gclient)
    me = gclient.get("/api/auth/me").json()
    assert me["google_linked"] and me["has_password"]
    assert len(users(gclient)) == 1


def test_unverified_google_email_rejected(gclient, identity, settings):
    identity["identity"] = replace(identity["identity"], email_verified=False)
    r = callback(gclient)
    assert r.headers["location"] == f"{settings.app_url}/signin?error=google"
    assert users(gclient) == []


def test_guest_upgrade_with_google_keeps_boards(gclient, identity):
    guest_id = gclient.post("/api/auth/guest").json()["id"]
    board_id = first_board(gclient)["id"]
    callback(gclient)
    me = gclient.get("/api/auth/me").json()
    assert me["id"] == guest_id
    assert me["is_guest"] is False
    assert me["email"] == "alice@example.com"
    assert first_board(gclient)["id"] == board_id


def test_guest_upgrade_with_google_email_in_use_rejected(gclient, identity, settings):
    sign_up(gclient)
    gclient.cookies.clear()
    gclient.post("/api/auth/guest")
    r = callback(gclient)
    assert r.headers["location"] == f"{settings.app_url}/signin?error=google"
    assert gclient.get("/api/auth/me").json()["is_guest"] is True


def test_email_linked_to_other_google_account_rejected(gclient, identity, settings):
    callback(gclient)
    gclient.cookies.clear()
    identity["identity"] = replace(identity["identity"], sub="g-other")
    r = callback(gclient)
    assert r.headers["location"] == f"{settings.app_url}/signin?error=google"
    assert len(users(gclient)) == 1
