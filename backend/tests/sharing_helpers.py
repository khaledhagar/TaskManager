"""Helpers for board sharing tests: invite, accept and set a member's role."""

from fastapi.testclient import TestClient


def user_id(client: TestClient) -> int:
    return client.get("/api/auth/me").json()["id"]


def invite(admin: TestClient, board_id: int, email: str):
    return admin.post(f"/api/boards/{board_id}/invites", json={"email": email})


def token_of(link: str) -> str:
    return link.split("#token=")[1]


def accept(member: TestClient, token: str):
    return member.post("/api/invites/accept", json={"token": token})


def set_role(admin: TestClient, board_id: int, member_id: int, role: str):
    return admin.patch(f"/api/boards/{board_id}/members/{member_id}", json={"role": role})


def join(admin: TestClient, member: TestClient, board_id: int, email: str, role="viewer") -> int:
    """Invite `member`, accept, and give them `role`. Returns the member's user id."""
    r = invite(admin, board_id, email)
    assert r.status_code == 201, r.text
    assert accept(member, token_of(r.json()["link"])).status_code == 200
    member_id = user_id(member)
    if role != "viewer":
        assert set_role(admin, board_id, member_id, role).status_code == 200
    return member_id
