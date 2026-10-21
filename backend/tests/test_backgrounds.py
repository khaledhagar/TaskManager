"""Board backgrounds, file storage and guest file cleanup (T-176 to T-183)."""

import io

import pytest
from file_helpers import PDF, jpeg_with_gps, png, storage, upload
from helpers import first_board, sign_up
from PIL import Image
from sqlmodel import Session, select

from app import files
from app.models import User
from app.storage import LocalStorage


@pytest.fixture
def user(client):
    sign_up(client)
    return client


# --- board backgrounds ------------------------------------------------------------------


def test_background_photo_is_shrunk_and_cleaned(user):
    board_id = first_board(user)["id"]
    r = user.put(
        f"/api/boards/{board_id}/background",
        files={"file": ("trip.jpg", jpeg_with_gps(), "image/jpeg")},
    )
    assert r.status_code == 200
    assert r.json()["kind"] == "image"
    image = user.get(f"/api/boards/{board_id}/background")
    assert image.headers["content-type"] == "image/webp"
    assert len(image.content) <= files.MAX_BACKGROUND_STORED
    stored = Image.open(io.BytesIO(image.content))
    assert stored.format == "WEBP"
    assert max(stored.size) <= 2560
    assert 0x8825 not in stored.getexif()
    assert first_board(user)["background"]["kind"] == "image"


def test_background_rejects_non_images(user):
    board_id = first_board(user)["id"]
    fake = user.put(
        f"/api/boards/{board_id}/background", files={"file": ("x.png", b"nope", "image/png")}
    )
    assert fake.status_code == 400
    pdf = user.put(
        f"/api/boards/{board_id}/background", files={"file": ("x.pdf", PDF, "application/pdf")}
    )
    assert pdf.status_code == 400


def test_background_upload_limit(user, monkeypatch):
    monkeypatch.setattr(files, "MAX_BACKGROUND_UPLOAD", 500)
    board_id = first_board(user)["id"]
    r = user.put(
        f"/api/boards/{board_id}/background",
        files={"file": ("x.png", png((300, 300)), "image/png")},
    )
    assert r.status_code == 413


def test_background_preset_and_remove(user):
    board_id = first_board(user)["id"]
    r = user.put(f"/api/boards/{board_id}/background/preset", json={"preset": "dusk"})
    assert r.json() == {"kind": "preset", "preset": "dusk", "version": r.json()["version"]}
    assert (
        user.put(f"/api/boards/{board_id}/background/preset", json={"preset": "neon"}).status_code
        == 422
    )
    user.put(f"/api/boards/{board_id}/background", files={"file": ("bg.png", png(), "image/png")})
    assert len(list(storage(user).root.iterdir())) == 1
    assert user.delete(f"/api/boards/{board_id}/background").status_code == 204
    assert first_board(user)["background"]["kind"] == "none"
    assert list(storage(user).root.iterdir()) == []
    assert user.get(f"/api/boards/{board_id}/background").status_code == 404


def test_background_counts_toward_quota(user, monkeypatch):
    board_id = first_board(user)["id"]
    user.put(f"/api/boards/{board_id}/background", files={"file": ("bg.png", png(), "image/png")})
    assert user.get("/api/files/usage").json()["used"] > 0


# --- storage ------------------------------------------------------------------


def test_local_storage(tmp_path):
    store = LocalStorage(tmp_path / "s")
    store.put("abc", b"data")
    assert store.get("abc") == b"data"
    assert store.get("missing") is None
    store.delete("abc")
    store.delete("abc")
    assert store.get("abc") is None
    with pytest.raises(ValueError):
        store.put("../escape", b"x")


def test_guest_cleanup_removes_files(client, settings):
    from datetime import UTC, datetime, timedelta

    from app.users import cleanup_guests

    client.post("/api/auth/guest")
    column_id = first_board(client)["columns"][0]["id"]
    guest_card = client.post(f"/api/columns/{column_id}/cards", json={"title": "x"}).json()["id"]
    assert upload(client, guest_card, "a.txt", b"x").status_code == 201
    with Session(client.app.state.engine, info={"storage": storage(client)}) as s:
        guest = s.exec(select(User)).one()
        guest.created_at = datetime.now(UTC) - timedelta(days=8)
        s.commit()
        assert cleanup_guests(s) == 1
    assert list(storage(client).root.iterdir()) == []
