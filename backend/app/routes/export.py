"""Download a board as CSV or JSON: any member (T-706 to T-708)."""

import json
from urllib.parse import quote

from fastapi import APIRouter, Response

from app.access import board_full_for
from app.auth import CurrentUser
from app.db import SessionDep
from app.export import board_csv, board_json

router = APIRouter(prefix="/api", tags=["export"])


def download(body: bytes | str, media_type: str, board_id: int, title: str, ext: str) -> Response:
    """Named after the board (any language), with a plain fallback for old browsers."""
    name = quote(f"{title}.{ext}")
    disposition = f"attachment; filename=\"board-{board_id}.{ext}\"; filename*=UTF-8''{name}"
    return Response(body, media_type=media_type, headers={"Content-Disposition": disposition})


@router.get("/boards/{board_id}/export.csv")
def export_csv(board_id: int, user: CurrentUser, session: SessionDep) -> Response:
    board = board_full_for(session, user, board_id)
    return download(board_csv(board), "text/csv; charset=utf-8", board_id, board.title, "csv")


@router.get("/boards/{board_id}/export.json")
def export_json(board_id: int, user: CurrentUser, session: SessionDep) -> Response:
    board = board_full_for(session, user, board_id)
    body = json.dumps(board_json(board), ensure_ascii=False, indent=2)
    return download(body, "application/json", board_id, board.title, "json")
