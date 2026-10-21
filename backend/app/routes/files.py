"""Card attachments: upload, download, delete, and storage usage."""

from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Request, Response, UploadFile, status
from sqlmodel import Session, func, select

from app import files, ratelimit
from app.access import card_for, require
from app.auth import CurrentUser
from app.db import SessionDep
from app.i18n import tr
from app.models import Attachment, Board, BoardColumn, BoardMember, Card, Role, User
from app.schemas import AttachmentOut
from app.storage import new_key

router = APIRouter(prefix="/api", tags=["files"])


def quota_for(user: User) -> int:
    return files.GUEST_QUOTA if user.is_guest else files.QUOTA


def used_bytes(session: Session, user: User) -> int:
    attachments = session.exec(
        select(func.coalesce(func.sum(Attachment.size), 0)).where(Attachment.owner_id == user.id)
    ).one()
    backgrounds = session.exec(
        select(func.coalesce(func.sum(Board.background_size), 0)).where(Board.owner_id == user.id)
    ).one()
    return attachments + backgrounds


def check_quota(session: Session, user: User, extra: int) -> None:
    if used_bytes(session, user) + extra > quota_for(user):
        limit = quota_for(user) // files.MB
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            tr("Not enough storage left. Your limit is {mb} MB.", mb=limit),
        )


async def read_upload(request: Request, file: UploadFile, limit: int) -> bytes:
    """Read at most `limit` bytes; anything larger is rejected."""
    files.require_length(request, limit)
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise files.too_large(limit)
    return data


def attachment_for(session: Session, user: User, attachment_id: int, need: Role) -> Attachment:
    stmt = (
        select(Attachment, BoardMember.role)
        .join(Card)
        .join(BoardColumn)
        .join(BoardMember, BoardMember.board_id == BoardColumn.board_id)
        .where(Attachment.id == attachment_id, BoardMember.user_id == user.id)
    )
    row = session.exec(stmt).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, tr("Not found"))
    require(row[1], need)
    return row[0]


@router.post("/cards/{card_id}/attachments", status_code=201)
async def upload_attachment(
    card_id: int, file: UploadFile, request: Request, user: CurrentUser, session: SessionDep
) -> AttachmentOut:
    card = card_for(session, user, card_id, Role.editor)
    ratelimit.enforce(request, f"upload:{user.id}", ratelimit.UPLOADS)
    data = await read_upload(request, file, files.MAX_ATTACHMENT)
    if len(card.attachments) >= files.MAX_PER_CARD:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            tr("Limit reached: at most {cap} files per card", cap=files.MAX_PER_CARD),
        )
    name = files.safe_filename(file.filename or "file")
    checked = files.check_attachment(name, data)
    check_quota(session, user, len(checked.data))
    key = new_key()
    request.app.state.storage.put(key, checked.data)
    attachment = Attachment(
        card_id=card.id,
        owner_id=user.id,
        filename=name,
        content_type=checked.content_type,
        size=len(checked.data),
        is_image=checked.is_image,
        storage_key=key,
    )
    session.add(attachment)
    session.commit()
    return AttachmentOut.model_validate(attachment)


@router.get("/attachments/{attachment_id}")
def download_attachment(
    attachment_id: int,
    request: Request,
    user: CurrentUser,
    session: SessionDep,
    inline: bool = False,
) -> Response:
    attachment = attachment_for(session, user, attachment_id, Role.viewer)
    data = request.app.state.storage.get(attachment.storage_key)
    if data is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, tr("Not found"))
    disposition = "inline" if inline and attachment.is_image else "attachment"
    return Response(
        data,
        media_type=attachment.content_type,
        headers={
            "Content-Disposition": f"{disposition}; filename*=UTF-8''{quote(attachment.filename)}",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "sandbox; default-src 'none'",
            "Cache-Control": "private, max-age=3600",
        },
    )


@router.delete("/attachments/{attachment_id}", status_code=204)
def delete_attachment(attachment_id: int, user: CurrentUser, session: SessionDep) -> None:
    session.delete(attachment_for(session, user, attachment_id, Role.editor))
    session.commit()


@router.get("/files/usage")
def usage(user: CurrentUser, session: SessionDep) -> dict:
    return {"used": used_bytes(session, user), "limit": quota_for(user)}
