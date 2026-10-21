"""Board background: upload a photo, choose a preset, remove it, or fetch the image."""

from typing import Literal

from fastapi import APIRouter, HTTPException, Request, Response, UploadFile, status

from app import files, ratelimit
from app.access import board_for
from app.activity import record
from app.auth import CurrentUser
from app.db import SessionDep
from app.file_cleanup import discard
from app.i18n import tr
from app.models import Board, Role
from app.routes.files import check_quota, read_upload
from app.schemas import BackgroundOut, Strict, background_out
from app.storage import new_key

router = APIRouter(prefix="/api/boards", tags=["background"])


class PresetIn(Strict):
    preset: Literal[files.PRESETS]  # type: ignore[valid-type]


def _clear_image(session: SessionDep, board: Board) -> None:
    discard(session, board.background_key)
    board.background_key = None
    board.background_size = 0


def _save(
    session: SessionDep, board: Board, user, kind: str = "background.changed"
) -> BackgroundOut:
    board.background_version += 1
    record(session, board.id, user, kind)
    session.commit()
    return background_out(board)


@router.put("/{board_id}/background")
async def upload_background(
    board_id: int, file: UploadFile, request: Request, user: CurrentUser, session: SessionDep
) -> BackgroundOut:
    board = board_for(session, user, board_id, Role.admin)
    ratelimit.enforce(request, f"upload:{user.id}", ratelimit.UPLOADS)
    data = files.make_background(await read_upload(request, file, files.MAX_BACKGROUND_UPLOAD))
    check_quota(session, user, len(data) - board.background_size)
    key = new_key()
    request.app.state.storage.put(key, data)
    _clear_image(session, board)
    board.background_kind, board.background_preset = "image", None
    board.background_key, board.background_size = key, len(data)
    return _save(session, board, user)


@router.put("/{board_id}/background/preset")
def set_preset(
    board_id: int, body: PresetIn, user: CurrentUser, session: SessionDep
) -> BackgroundOut:
    board = board_for(session, user, board_id, Role.admin)
    _clear_image(session, board)
    board.background_kind, board.background_preset = "preset", body.preset
    return _save(session, board, user)


@router.delete("/{board_id}/background", status_code=204)
def remove_background(board_id: int, user: CurrentUser, session: SessionDep) -> None:
    board = board_for(session, user, board_id, Role.admin)
    _clear_image(session, board)
    board.background_kind, board.background_preset = "none", None
    _save(session, board, user, "background.removed")


@router.get("/{board_id}/background")
def get_background(
    board_id: int, request: Request, user: CurrentUser, session: SessionDep
) -> Response:
    board = board_for(session, user, board_id)
    data = request.app.state.storage.get(board.background_key) if board.background_key else None
    if data is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, tr("Not found"))
    return Response(
        data,
        media_type="image/webp",
        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=86400"},
    )
