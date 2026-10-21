"""Members, access requests and cleanup (T-523 to T-529, T-532, T-537, T-538)."""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from helpers import first_board, outbox, sign_up
from sharing_helpers import invite, join, set_role, user_id
from sqlmodel import Session, select

from app import ratelimit
from app.models import AccessRequest, BoardInvite, BoardMember, User


@pytest.fixture
def alice(client):
    sign_up(client, "alice@example.com")
    return client


@pytest.fixture
def bob(alice):
    with TestClient(alice.app) as c:
        sign_up(c, "bob@example.com")
        yield c


@pytest.fixture
def board_id(alice):
    return first_board(alice)["id"]


def members(client, board_id):
    return client.get(f"/api/boards/{board_id}/members").json()


# --- members ---------------------------------------------------------------------


def test_members_list_for_admin_and_member(alice, bob, board_id):
    join(alice, bob, board_id, "bob@example.com", "updater")
    invite(alice, board_id, "carol@example.com")
    admin_view = members(alice, board_id)
    assert [(m["email"], m["role"]) for m in admin_view["members"]] == [
        ("alice@example.com", "admin"),
        ("bob@example.com", "updater"),
    ]
    assert [i["email"] for i in admin_view["invites"]] == ["carol@example.com"]
    member_view = members(bob, board_id)
    assert len(member_view["members"]) == 2
    assert member_view["invites"] == [] and member_view["requests"] == []


def test_admin_row_is_fixed(alice, bob, board_id):
    join(alice, bob, board_id, "bob@example.com", "editor")
    admin = user_id(alice)
    assert set_role(alice, board_id, admin, "viewer").status_code == 400
    assert alice.delete(f"/api/boards/{board_id}/members/{admin}").status_code == 400
    assert set_role(alice, board_id, user_id(bob), "admin").status_code == 422


def test_remove_member_and_leave(alice, bob, board_id):
    bob_id = join(alice, bob, board_id, "bob@example.com")
    assert alice.delete(f"/api/boards/{board_id}/members/{bob_id}").status_code == 204
    assert bob.get(f"/api/boards/{board_id}").status_code == 404
    join(alice, bob, board_id, "bob@example.com")
    assert bob.delete(f"/api/boards/{board_id}/members/{bob_id}").status_code == 204
    assert board_id not in [b["id"] for b in bob.get("/api/boards").json()]


def test_only_admin_changes_roles_or_removes_others(alice, bob, board_id):
    join(alice, bob, board_id, "bob@example.com", "editor")
    with TestClient(alice.app) as carol:
        sign_up(carol, "carol@example.com")
        carol_id = join(alice, carol, board_id, "carol@example.com")
    assert set_role(bob, board_id, carol_id, "editor").status_code == 403
    assert bob.delete(f"/api/boards/{board_id}/members/{carol_id}").status_code == 403


# --- access requests -------------------------------------------------------------


def test_request_access_emails_the_admin_once(alice, bob, board_id):
    join(alice, bob, board_id, "bob@example.com")
    sent = len(outbox(alice))
    r = bob.post(f"/api/boards/{board_id}/access-requests")
    assert r.status_code == 201
    assert len(outbox(alice)) == sent + 1
    mail = outbox(alice)[-1]
    assert mail.to == "alice@example.com"
    assert "bob@example.com" in mail.text and f"/?board={board_id}&members=1" in mail.text
    assert bob.post(f"/api/boards/{board_id}/access-requests").status_code == 201
    assert len(outbox(alice)) == sent + 1
    assert members(bob, board_id)["requested"] is True


def test_full_access_members_cannot_request(alice, bob, board_id):
    join(alice, bob, board_id, "bob@example.com", "editor")
    assert bob.post(f"/api/boards/{board_id}/access-requests").status_code == 400


def test_approve_sets_role_and_decline_removes(alice, bob, board_id):
    join(alice, bob, board_id, "bob@example.com")
    bob.post(f"/api/boards/{board_id}/access-requests")
    request_id = members(alice, board_id)["requests"][0]["id"]
    assert (
        bob.post(f"/api/access-requests/{request_id}/approve", json={"role": "editor"}).status_code
        == 403
    )
    assert (
        alice.post(
            f"/api/access-requests/{request_id}/approve", json={"role": "editor"}
        ).status_code
        == 200
    )
    assert bob.get(f"/api/boards/{board_id}").json()["role"] == "editor"
    set_role(alice, board_id, user_id(bob), "viewer")
    bob.post(f"/api/boards/{board_id}/access-requests")
    request_id = members(alice, board_id)["requests"][0]["id"]
    assert alice.delete(f"/api/access-requests/{request_id}").status_code == 204
    assert members(alice, board_id)["requests"] == []
    assert bob.get(f"/api/boards/{board_id}").json()["role"] == "viewer"


def test_access_request_rate_limit(alice, bob, board_id, monkeypatch):
    monkeypatch.setattr(ratelimit, "ACCESS_REQUESTS", ratelimit.Limit(1, 86400))
    join(alice, bob, board_id, "bob@example.com")
    assert bob.post(f"/api/boards/{board_id}/access-requests").status_code == 201
    request_id = members(alice, board_id)["requests"][0]["id"]
    alice.delete(f"/api/access-requests/{request_id}")
    assert bob.post(f"/api/boards/{board_id}/access-requests").status_code == 429


# --- cleanup ---------------------------------------------------------------------


def test_deleting_board_or_account_removes_sharing_rows(alice, bob, board_id):
    join(alice, bob, board_id, "bob@example.com")
    bob.post(f"/api/boards/{board_id}/access-requests")
    invite(alice, board_id, "carol@example.com")
    assert alice.delete(f"/api/boards/{board_id}").status_code == 204
    with Session(alice.app.state.engine) as s:
        assert not s.exec(select(BoardInvite)).all()
        assert not s.exec(select(AccessRequest)).all()
        assert not s.exec(select(BoardMember).where(BoardMember.board_id == board_id)).all()
    assert bob.delete("/api/auth/me").status_code == 204
    with Session(alice.app.state.engine) as s:
        assert not s.exec(
            select(BoardMember).join(User).where(User.email == "bob@example.com")
        ).all()


def test_guest_cleanup_removes_guest_memberships(alice, board_id):
    from app.users import cleanup_guests

    with Session(alice.app.state.engine) as s:
        guest = User(is_guest=True, created_at=datetime.now(UTC) - timedelta(days=8))
        s.add(guest)
        s.commit()
        s.add(BoardMember(board_id=board_id, user_id=guest.id, role="viewer"))
        s.commit()
        cleanup_guests(s)
        assert len(s.exec(select(BoardMember).where(BoardMember.board_id == board_id)).all()) == 1


def test_members_and_board_list_take_few_queries_whatever_the_member_count(alice, board_id):
    from sqlalchemy import event

    def count(url):
        queries = []
        listener = lambda *a: queries.append(1)  # noqa: E731
        event.listen(alice.app.state.engine, "before_cursor_execute", listener)
        alice.get(url)
        event.remove(alice.app.state.engine, "before_cursor_execute", listener)
        return len(queries)

    def add_members(start, n):
        with Session(alice.app.state.engine) as s:
            for i in range(start, start + n):
                user = User(email=f"m{i}@example.com", email_verified=True)
                s.add(user)
                s.flush()
                s.add(BoardMember(board_id=board_id, user_id=user.id, role="viewer"))
                s.add(AccessRequest(board_id=board_id, user_id=user.id))
            s.commit()

    add_members(0, 1)
    before = (count(f"/api/boards/{board_id}/members"), count("/api/boards"))
    add_members(1, 30)
    after = (count(f"/api/boards/{board_id}/members"), count("/api/boards"))
    assert after == before


def test_non_members_get_404_on_sharing_endpoints(alice, bob, board_id):
    invite_id = invite(alice, board_id, "dave@example.com").json()["id"]
    with TestClient(alice.app) as carol:
        sign_up(carol, "carol@example.com")
        carol_id = join(alice, carol, board_id, "carol@example.com")
        carol.post(f"/api/boards/{board_id}/access-requests")
    request_id = members(alice, board_id)["requests"][0]["id"]
    calls = [
        ("get", f"/api/boards/{board_id}/members", None),
        ("patch", f"/api/boards/{board_id}/members/{carol_id}", {"role": "editor"}),
        ("delete", f"/api/boards/{board_id}/members/{carol_id}", None),
        ("post", f"/api/boards/{board_id}/invites", {"email": "x@example.com"}),
        ("post", f"/api/invites/{invite_id}/resend", None),
        ("delete", f"/api/invites/{invite_id}", None),
        ("post", f"/api/boards/{board_id}/access-requests", None),
        ("post", f"/api/access-requests/{request_id}/approve", {"role": "editor"}),
        ("delete", f"/api/access-requests/{request_id}", None),
    ]
    for method, url, body in calls:
        assert bob.request(method, url, json=body).status_code == 404, (method, url)
