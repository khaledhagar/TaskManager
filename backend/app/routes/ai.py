"""AI routes: checklist suggestions, board starter and chat."""

from typing import Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field
from sqlmodel import func, select

from app import ai, assistant, limits
from app.access import owned_board, owned_card
from app.auth import CurrentUser
from app.db import SessionDep
from app.models import Board
from app.schemas import BoardSummary, Strict, text
from app.seed import build_from_data

router = APIRouter(prefix="/api/ai", tags=["ai"])


class Suggestions(BaseModel):
    items: list[str]


class BoardPrompt(Strict):
    description: text(500)


class ChatMessage(Strict):
    role: Literal["user", "assistant"]
    content: text(2000)


class ChatRequest(Strict):
    board_id: int
    messages: list[ChatMessage] = Field(min_length=1, max_length=100)


class ChatReply(BaseModel):
    reply: str
    actions: list[assistant.ChatAction]


def _key(request: Request) -> str:
    return request.app.state.settings.openrouter_api_key


@router.post("/cards/{card_id}/checklist")
def suggest_checklist(
    card_id: int, request: Request, user: CurrentUser, session: SessionDep
) -> Suggestions:
    card = owned_card(session, user, card_id)
    draft = ai.complete(assistant.checklist_messages(card), assistant.ChecklistDraft, _key(request))
    return Suggestions(items=assistant.clean_checklist(draft))


@router.post("/boards", status_code=201)
def board_starter(
    body: BoardPrompt, request: Request, user: CurrentUser, session: SessionDep
) -> BoardSummary:
    count = session.exec(select(func.count()).where(Board.owner_id == user.id)).one()
    limits.check(count, limits.BOARDS_PER_USER, "boards")
    messages = assistant.board_messages(body.description)
    draft = ai.complete(messages, assistant.BoardDraft, _key(request))
    board = build_from_data(session, user.id, assistant.clean_board(draft))
    return BoardSummary.model_validate(board)


@router.post("/chat")
def chat(body: ChatRequest, request: Request, user: CurrentUser, session: SessionDep) -> ChatReply:
    board = owned_board(session, user, body.board_id)
    history = [m.model_dump() for m in body.messages]
    draft = ai.complete(assistant.chat_messages(board, history), assistant.ChatDraft, _key(request))
    return ChatReply(
        reply=draft.reply.strip()[:4000], actions=assistant.clean_actions(board, draft.actions)
    )
