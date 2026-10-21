"""Attachments and file safety (T-170 to T-183, T-090)."""

import io

import pytest
from fastapi.testclient import TestClient
from file_helpers import PDF, docx, jpeg_with_gps, png, storage, upload
from helpers import first_board, sign_up
from PIL import Image
from sqlmodel import Session, select

from app import files
from app.models import Attachment


@pytest.fixture
def user(client):
    sign_up(client)
    return client


@pytest.fixture
def card_id(user):
    return first_board(user)["columns"][0]["cards"][0]["id"]


# --- attachments --------------------------------------------------------------------


def test_upload_list_download_delete(user, card_id):
    r = upload(user, card_id, "spec.pdf", PDF, "application/pdf")
    assert r.status_code == 201
    att = r.json()
    assert att["filename"] == "spec.pdf"
    assert att["content_type"] == "application/pdf"
    assert att["size"] == len(PDF)
    assert att["is_image"] is False
    card = first_board(user)["columns"][0]["cards"][0]
    assert [a["id"] for a in card["attachments"]] == [att["id"]]
    download = user.get(f"/api/attachments/{att['id']}")
    assert download.status_code == 200
    assert download.content == PDF
    assert user.delete(f"/api/attachments/{att['id']}").status_code == 204
    assert user.get(f"/api/attachments/{att['id']}").status_code == 404
    assert list(storage(user).root.iterdir()) == []


@pytest.mark.parametrize(
    ("name", "data", "ctype"),
    [
        ("photo.png", png(), "image/png"),
        ("notes.txt", "Plain notes, UTF-8: café".encode(), "text/plain"),
        ("data.csv", b"a,b\n1,2\n", "text/csv"),
        ("report.docx", docx(), "application/octet-stream"),
    ],
)
def test_allowed_types(user, card_id, name, data, ctype):
    r = upload(user, card_id, name, data, ctype)
    assert r.status_code == 201, r.text
    assert r.json()["is_image"] is name.endswith(".png")


def test_file_too_large(user, card_id, monkeypatch):
    monkeypatch.setattr(files, "MAX_ATTACHMENT", 1000)
    assert upload(user, card_id, "big.txt", b"x" * 2000).status_code == 413


def test_too_many_files_on_a_card(user, card_id, monkeypatch):
    monkeypatch.setattr(files, "MAX_PER_CARD", 2)
    assert upload(user, card_id, "a.txt", b"a").status_code == 201
    assert upload(user, card_id, "b.txt", b"b").status_code == 201
    r = upload(user, card_id, "c.txt", b"c")
    assert r.status_code == 400
    assert "limit" in r.json()["detail"].lower()


def test_account_quota(user, card_id, monkeypatch):
    monkeypatch.setattr(files, "QUOTA", 150)
    assert upload(user, card_id, "a.txt", b"x" * 100).status_code == 201
    r = upload(user, card_id, "b.txt", b"x" * 100)
    assert r.status_code == 400
    assert "storage" in r.json()["detail"].lower()


def test_guest_quota_is_smaller(client, monkeypatch):
    monkeypatch.setattr(files, "GUEST_QUOTA", 50)
    client.post("/api/auth/guest")
    column_id = first_board(client)["columns"][0]["id"]
    guest_card = client.post(f"/api/columns/{column_id}/cards", json={"title": "x"}).json()["id"]
    assert upload(client, guest_card, "a.txt", b"x" * 60).status_code == 400


@pytest.mark.parametrize(
    ("name", "data"),
    [
        ("invoice.pdf", b"MZ\x90\x00 this is a windows program"),
        ("drawing.svg", b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"),
        ("page.html", b"<html><script>alert(1)</script></html>"),
        ("run.exe", b"MZ\x90\x00"),
        ("script.js", b"alert(1)"),
        ("noext", b"hello"),
        ("binary.txt", b"\x00\x01\x02 not text"),
        ("fake.docx", b"PK\x03\x04 not really a zip"),
    ],
)
def test_blocked_files(user, card_id, name, data):
    r = upload(user, card_id, name, data)
    assert r.status_code == 400, name
    assert list(storage(user).root.iterdir()) == []


def test_fake_image_rejected(user, card_id):
    assert upload(user, card_id, "photo.png", b"not an image at all").status_code == 400


def test_image_attachment_metadata_stripped(user, card_id):
    r = upload(user, card_id, "trip.jpg", jpeg_with_gps((200, 100)), "image/jpeg")
    assert r.status_code == 201
    stored = Image.open(io.BytesIO(user.get(f"/api/attachments/{r.json()['id']}").content))
    assert 0x8825 not in stored.getexif()
    assert 0x010F not in stored.getexif()


def test_storage_key_random_and_filename_sanitized(user, card_id):
    r = upload(user, card_id, "../../etc/pass wd.txt", b"hello")
    assert r.status_code == 201
    assert r.json()["filename"] == "pass wd.txt"
    with Session(user.app.state.engine) as s:
        att = s.exec(select(Attachment)).one()
    assert len(att.storage_key) == 32 and ".." not in att.storage_key
    assert [p.name for p in storage(user).root.iterdir()] == [att.storage_key]


def test_other_users_get_404(user, card_id):
    att = upload(user, card_id, "spec.pdf", PDF).json()
    board_id = first_board(user)["id"]
    user.put(f"/api/boards/{board_id}/background/preset", json={"preset": "navy"})
    with TestClient(user.app) as bob:
        sign_up(bob, "bob@example.com")
        assert bob.get(f"/api/attachments/{att['id']}").status_code == 404
        assert bob.delete(f"/api/attachments/{att['id']}").status_code == 404
        assert upload(bob, card_id, "x.txt", b"x").status_code == 404
        assert bob.get(f"/api/boards/{board_id}/background").status_code == 404
        assert bob.delete(f"/api/boards/{board_id}/background").status_code == 404
    assert user.get(f"/api/attachments/{att['id']}").status_code == 200


def test_download_headers(user, card_id):
    pdf = upload(user, card_id, "spec sheet.pdf", PDF).json()
    r = user.get(f"/api/attachments/{pdf['id']}")
    assert r.headers["content-type"] == "application/pdf"
    assert r.headers["content-disposition"].startswith("attachment;")
    assert "spec%20sheet.pdf" in r.headers["content-disposition"]
    assert r.headers["x-content-type-options"] == "nosniff"
    assert "sandbox" in r.headers["content-security-policy"]
    image = upload(user, card_id, "a.png", png()).json()
    inline = user.get(f"/api/attachments/{image['id']}?inline=1")
    assert inline.headers["content-disposition"].startswith("inline;")
    forced = user.get(f"/api/attachments/{pdf['id']}?inline=1")
    assert forced.headers["content-disposition"].startswith("attachment;")


def test_cross_site_upload_rejected(user, card_id, settings):
    evil = upload(user, card_id, "a.txt", b"a", headers={"Origin": "https://evil.example"})
    assert evil.status_code == 403
    same = upload(user, card_id, "a.txt", b"a", headers={"Origin": settings.app_url})
    assert same.status_code == 201


def test_cross_site_json_post_rejected(user):
    r = user.post("/api/boards", json={"title": "x"}, headers={"Origin": "https://evil.example"})
    assert r.status_code == 403


def test_missing_content_length_rejected(user, card_id):
    body = (
        b'--b\r\nContent-Disposition: form-data; name="file"; filename="a.txt"\r\n'
        b"\r\nhi\r\n--b--\r\n"
    )

    def chunks():
        yield body

    r = user.post(
        f"/api/cards/{card_id}/attachments",
        content=chunks(),
        headers={"Content-Type": "multipart/form-data; boundary=b"},
    )
    assert r.status_code == 411


@pytest.mark.parametrize("target", ["card", "column", "board", "account"])
def test_deleting_owner_removes_files(user, card_id, target):
    upload(user, card_id, "spec.pdf", PDF)
    board = first_board(user)
    user.put(
        f"/api/boards/{board['id']}/background",
        files={"file": ("bg.png", png((80, 60)), "image/png")},
    )
    assert len(list(storage(user).root.iterdir())) == 2
    url = {
        "card": f"/api/cards/{card_id}",
        "column": f"/api/columns/{board['columns'][0]['id']}",
        "board": f"/api/boards/{board['id']}",
        "account": "/api/auth/me",
    }[target]
    assert user.delete(url).status_code == 204
    remaining = len(list(storage(user).root.iterdir()))
    assert remaining == (1 if target in ("card", "column") else 0)


def test_usage_reports_bytes_and_limit(user, card_id):
    upload(user, card_id, "a.txt", b"x" * 123)
    assert user.get("/api/files/usage").json() == {"used": 123, "limit": files.QUOTA}


@pytest.mark.parametrize(
    ("raw", "clean"),
    [
        ("pa\x00ss\x1f wd.txt", "pass wd.txt"),
        ("C:\\Users\\me\\report.pdf", "report.pdf"),
        ("...", "file"),
        ("a" * 300 + ".txt", "a" * 116 + ".txt"),
    ],
)
def test_safe_filename(raw, clean):
    assert files.safe_filename(raw) == clean
