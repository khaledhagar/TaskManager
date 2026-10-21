"""Stars, own templates, card covers and focus sessions (T-684, T-685, T-688, T-696, T-697)."""

from fastapi import APIRouter, HTTPException, status
from sqlmodel import func, select

from app import limits, organize
from app.access import board_for, board_full_for, card_for, not_found
from app.activity import record
from app.auth import CurrentUser
from app.db import SessionDep
from app.i18n import tr
from app.models import Attachment, BoardStar, FocusSession, Role, UserTemplate
from app.organize import own_template
from app.schemas import CardOut, card_out
from app.schemas_organize import CoverSet, FocusCreate, FocusOut, TemplateCreate, TemplateOut

router = APIRouter(prefix="/api", tags=["organize"])


@router.put("/boards/{board_id}/star", status_code=204)
def star(board_id: int, user: CurrentUser, session: SessionDep) -> None:
    board_for(session, user, board_id)
    if session.get(BoardStar, (user.id, board_id)) is None:
        session.add(BoardStar(user_id=user.id, board_id=board_id))
        session.commit()


@router.delete("/boards/{board_id}/star", status_code=204)
def unstar(board_id: int, user: CurrentUser, session: SessionDep) -> None:
    board_for(session, user, board_id)
    row = session.get(BoardStar, (user.id, board_id))
    if row is not None:
        session.delete(row)
        session.commit()


def template_out(template: UserTemplate) -> TemplateOut:
    return TemplateOut(id=template.id, name=template.name, created_at=template.created_at)


@router.get("/templates")
def list_templates(user: CurrentUser, session: SessionDep) -> list[TemplateOut]:
    stmt = select(UserTemplate).where(UserTemplate.user_id == user.id).order_by(UserTemplate.id)
    return [template_out(t) for t in session.exec(stmt)]


@router.post("/templates", status_code=201)
def save_template(body: TemplateCreate, user: CurrentUser, session: SessionDep) -> TemplateOut:
    """Private to the user who saves it; at most 20 each (SEC-207)."""
    board_for(session, user, body.board_id, Role.editor)
    board = board_full_for(session, user, body.board_id)
    count = session.exec(select(func.count()).where(UserTemplate.user_id == user.id)).one()
    limits.check(count, organize.TEMPLATES_PER_USER, "Limit reached: at most {cap} templates")
    data = organize.board_to_data(board, dates=False)
    template = UserTemplate(user_id=user.id, name=body.name, data=data | {"title": body.name})
    session.add(template)
    session.commit()
    return template_out(template)


@router.delete("/templates/{template_id}", status_code=204)
def delete_template(template_id: int, user: CurrentUser, session: SessionDep) -> None:
    session.delete(own_template(session, user, template_id))
    session.commit()


@router.put("/cards/{card_id}/cover")
def set_cover(card_id: int, body: CoverSet, user: CurrentUser, session: SessionDep) -> CardOut:
    """Only an image attached to the same card can be its cover."""
    card = card_for(session, user, card_id, Role.editor)
    if body.attachment_id is not None:
        attachment = session.get(Attachment, body.attachment_id)
        if attachment is None or attachment.card_id != card.id:
            raise not_found()
        if not attachment.is_image:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, tr("Only an image can be a cover"))
    card.cover_attachment_id = body.attachment_id
    record(session, card.column.board_id, user, "card.cover", card)
    session.commit()
    return card_out(card)


@router.post("/cards/{card_id}/focus-sessions", status_code=201)
def add_focus(card_id: int, body: FocusCreate, user: CurrentUser, session: SessionDep) -> FocusOut:
    """Saved for the signed-in user only, at most 60 minutes (SEC-214)."""
    card = card_for(session, user, card_id, Role.updater)
    card.focus_sessions.append(FocusSession(user_id=user.id, minutes=body.minutes))
    session.commit()
    return FocusOut(
        focus_count=len(card.focus_sessions),
        focus_minutes=sum(f.minutes for f in card.focus_sessions),
    )
