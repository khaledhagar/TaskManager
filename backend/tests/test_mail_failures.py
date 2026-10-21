"""When an email cannot be sent: clear answers, nothing left half done (T-760 to T-763)."""

import pytest
from fastapi.testclient import TestClient
from helpers import PASSWORD, first_board, link_token, outbox, sign_up
from sharing_helpers import join, user_id

from app.mailer import MailError

MESSAGE = "We couldn't send the email right now. Please try again in a few minutes."


@pytest.fixture
def broken(client, monkeypatch):
    """Make every email fail, as when the mail server cannot be reached."""

    def fail(_email):
        raise MailError("timed out")

    monkeypatch.setattr(client.app.state.mailer, "send", fail)
    return monkeypatch


def signup(client, email="alice@example.com"):
    return client.post("/api/auth/signup", json={"email": email, "password": PASSWORD})


def test_signup_says_so_and_keeps_no_account(client, broken):
    r = signup(client)
    assert r.status_code == 503
    assert r.json()["detail"] == MESSAGE
    broken.undo()
    assert signup(client).status_code == 201
    assert client.post("/api/auth/verify", json={"token": link_token(client)}).status_code == 200


def test_the_message_is_translated(client, broken):
    r = client.post(
        "/api/auth/signup",
        json={"email": "a@example.com", "password": PASSWORD},
        headers={"Accept-Language": "ar"},
    )
    assert r.status_code == 503 and r.json()["detail"] != MESSAGE


def test_guest_upgrade_is_undone(client, broken):
    client.post("/api/auth/guest")
    body = {"email": "guest@example.com", "password": PASSWORD}
    assert client.post("/api/auth/upgrade", json=body).status_code == 503
    assert client.get("/api/auth/me").json()["email"] is None
    broken.undo()
    assert client.post("/api/auth/upgrade", json=body).status_code == 200


def test_reset_and_resend_keep_their_neutral_answer(client):
    sign_up(client)

    def fail(_email):
        raise MailError("timed out")

    client.app.state.mailer.send = fail
    body = {"email": "alice@example.com"}
    assert client.post("/api/auth/forgot-password", json=body).status_code == 202
    assert client.post("/api/auth/resend-verification", json=body).status_code in (200, 202)


def test_assignment_still_works_when_its_email_fails(client):
    sign_up(client, "alice@example.com")
    with TestClient(client.app) as bob:
        sign_up(bob, "bob@example.com")
        board = first_board(client)
        bob_id = join(client, bob, board["id"], "bob@example.com", "editor")
        card = board["columns"][0]["cards"][0]

        def fail(_email):
            raise MailError("timed out")

        client.app.state.mailer.send = fail
        r = client.put(f"/api/cards/{card['id']}/assignees", json={"user_ids": [bob_id]})
        assert r.status_code == 200
        kinds = [n["kind"] for n in bob.get("/api/notifications").json()["items"]]
        assert "assigned" in kinds
        assert user_id(bob) == bob_id


def test_an_invitation_can_be_sent_again_after_a_failure(client, monkeypatch):
    sign_up(client)
    board = first_board(client)

    def fail(_email):
        raise MailError("timed out")

    real = client.app.state.mailer.send
    monkeypatch.setattr(client.app.state.mailer, "send", fail)
    body = {"email": "carol@example.com"}
    assert client.post(f"/api/boards/{board['id']}/invites", json=body).status_code == 503
    monkeypatch.setattr(client.app.state.mailer, "send", real)
    assert client.post(f"/api/boards/{board['id']}/invites", json=body).status_code == 201
    assert outbox(client)[-1].to == "carol@example.com"
