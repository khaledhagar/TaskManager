"""Security headers, production settings, error handling and request limits (Phase 14)."""

import logging
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient
from helpers import PASSWORD, first_board, sign_up

from app import factory
from app.config import Settings, load_settings

CSP = (
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; "
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
)


@pytest.fixture
def production(settings):
    """A production app; TestClient's host name is the allowed host."""
    app = factory.create_app(replace(settings, env="production", allowed_hosts=("testserver",)))
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.state.engine.dispose()


# --- T-130, T-131 headers -------------------------------------------------------------------


@pytest.mark.parametrize("path", ["/", "/api/health", "/assets/app.js", "/api/nope"])
def test_security_headers_on_every_response(client, path):
    headers = client.get(path).headers
    assert headers["content-security-policy"] == CSP
    assert headers["x-content-type-options"] == "nosniff"
    assert headers["referrer-policy"] == "strict-origin-when-cross-origin"
    # Voice input (Phase 21): only this site may use the microphone (SEC-180).
    assert headers["permissions-policy"] == "camera=(), microphone=(self), geolocation=()"
    assert "strict-transport-security" not in headers


def test_hsts_only_in_production(production):
    hsts = production.get("/api/health").headers["strict-transport-security"]
    assert hsts == "max-age=31536000; includeSubDomains"


def test_routes_can_keep_a_stricter_policy(client):
    """Attachment downloads set their own sandbox CSP; the middleware must not replace it."""
    sign_up(client)
    card = first_board(client)["columns"][0]["cards"][0]
    upload = client.post(
        f"/api/cards/{card['id']}/attachments", files={"file": ("a.txt", b"hello", "text/plain")}
    )
    r = client.get(f"/api/attachments/{upload.json()['id']}")
    assert r.headers["content-security-policy"] == "sandbox; default-src 'none'"


# --- T-005, T-132 production settings ---------------------------------------------------------


@pytest.mark.parametrize("path", ["/docs", "/redoc", "/openapi.json"])
def test_api_docs_only_outside_production(client, production, path):
    assert client.get(path).status_code == 200
    assert production.get(path).headers["content-type"].startswith("text/html")  # SPA page
    assert "openapi" not in production.get(path).text.lower()


def test_untrusted_host_rejected_in_production(production):
    assert production.get("/api/health").status_code == 200
    assert production.get("/api/health", headers={"host": "evil.example"}).status_code == 400


def test_allowed_hosts_default_to_the_app_url_host(monkeypatch):
    monkeypatch.setenv("APP_URL", "https://tasks.example.com")
    monkeypatch.delenv("ALLOWED_HOSTS", raising=False)
    assert load_settings().allowed_hosts == ("tasks.example.com",)
    monkeypatch.setenv("ALLOWED_HOSTS", "a.example.com, b.example.com")
    assert load_settings().allowed_hosts == ("a.example.com", "b.example.com")


# --- T-004 generic errors -----------------------------------------------------------------------


def test_unhandled_error_is_generic_json(production, monkeypatch):
    def broken(*_args):
        raise RuntimeError("secret internal detail")

    monkeypatch.setattr(factory, "text", broken)
    r = production.get("/api/health", headers={"accept-language": "ar"})
    assert r.status_code == 500
    assert r.json() == {"detail": "حدث خطأ من جهتنا. حاول مرة أخرى."}
    assert "secret" not in r.text


# --- T-091, T-093 request bodies; SEC-30 CORS ------------------------------------------------


def test_body_over_1_mb_is_rejected(client):
    sign_up(client)
    r = client.post(
        "/api/boards",
        content=b"{" + b" " * (1024 * 1024) + b"}",
        headers={"content-type": "application/json"},
    )
    assert r.status_code == 413


def test_form_encoded_body_is_rejected(client):
    sign_up(client)
    r = client.post("/api/boards", data={"title": "From a form"})
    assert r.status_code == 422
    assert [b["title"] for b in client.get("/api/boards").json()] == ["Website Launch"]


def test_no_cors_headers_for_other_origins(client):
    r = client.options(
        "/api/boards",
        headers={"origin": "https://evil.example", "access-control-request-method": "POST"},
    )
    assert "access-control-allow-origin" not in r.headers


# --- SEC-94 logs ----------------------------------------------------------------------------------


def test_logs_never_contain_passwords_or_tokens(settings, caplog):
    app = factory.create_app(replace(settings, env="production", allowed_hosts=("testserver",)))
    with caplog.at_level(logging.DEBUG), TestClient(app) as c:
        c.post("/api/auth/signup", json={"email": "a@example.com", "password": PASSWORD})
        c.post("/api/auth/signin", json={"email": "a@example.com", "password": PASSWORD})
        c.post("/api/auth/forgot-password", json={"email": "a@example.com"})
    app.state.engine.dispose()
    token = app.state.mailer.outbox[-1].text.split("token=")[1].split()[0]
    assert PASSWORD not in caplog.text
    assert token not in caplog.text


def test_email_links_keep_the_token_out_of_requests(client):
    """The token sits after '#': browsers never send it to servers, logs or Referer (SEC-122)."""
    client.post("/api/auth/signup", json={"email": "a@example.com", "password": PASSWORD})
    link = client.app.state.mailer.outbox[-1].text.split("http://app.test")[1].split()[0]
    assert link.startswith("/verify#token=")
    assert "?" not in link


def test_production_needs_allowed_hosts():
    with pytest.raises(ValueError, match="ALLOWED_HOSTS"):
        Settings(jwt_secret="x" * 40, env="production")


def test_settings_reject_unknown_env():
    with pytest.raises(ValueError, match="ENV"):
        Settings(jwt_secret="x" * 40, env="prod")


def test_server_shows_app_info_logs(monkeypatch, tmp_path):
    """Console-mode email links are INFO logs; the real server must print them."""
    import importlib

    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'main.db'}")
    monkeypatch.setenv("STORAGE_DIR", str(tmp_path / "storage"))
    monkeypatch.setattr(logging.getLogger("taskmanager"), "level", logging.NOTSET)
    importlib.import_module("app.main")
    assert logging.getLogger("taskmanager.mail").isEnabledFor(logging.INFO)
