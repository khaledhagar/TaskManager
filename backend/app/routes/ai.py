"""AI routes: checklist suggestions, board starter, column names and chat."""

from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from sqlmodel import func, select

from app import ai, assistant, columns_ai, limits, ratelimit
from app.access import board_full_for, card_for
from app.auth import CurrentUser
from app.db import SessionDep
from app.models import Board, Role, User
from app.schemas import BoardSummary, Strict, board_summary, text
from app.seed import build_from_data

router = APIRouter(prefix="/api/ai", tags=["ai"])


class Suggestions(BaseModel):
    items: list[str]


class BoardPrompt(Strict):
    description: text(500)


class ColumnsPrompt(Strict):
    boards: list[text(200)] = Field(min_length=1, max_length=10)
    workspace: text(100) | None = None


class BoardColumns(BaseModel):
    title: str
    columns: list[str]


class ColumnSuggestions(BaseModel):
    boards: list[BoardColumns]
    # False when the defaults were used because the AI was busy, failing or out of quota.
    ai: bool


class ChatMessage(Strict):
    role: Literal["user", "assistant"]
    content: text(2000)


class ChatRequest(Strict):
    board_id: int
    messages: list[ChatMessage] = Field(min_length=1, max_length=100)


class ChatReply(BaseModel):
    reply: str
    actions: list[assistant.ChatAction]


def _key(request: Request, user: User) -> str:
    """The API key for one model call, counted against the user's AI limits (SEC-52)."""
    ratelimit.enforce(request, f"ai-minute:{user.id}", ratelimit.AI_PER_MINUTE, ratelimit.AI_MINUTE)
    ratelimit.enforce(request, f"ai-day:{user.id}", ratelimit.AI_PER_DAY, ratelimit.AI_DAY)
    return request.app.state.settings.openrouter_api_key


@router.post("/cards/{card_id}/checklist")
def suggest_checklist(
    card_id: int, request: Request, user: CurrentUser, session: SessionDep
) -> Suggestions:
    card = card_for(session, user, card_id, Role.editor)
    draft = ai.complete(
        assistant.checklist_messages(card), assistant.ChecklistDraft, _key(request, user)
    )
    return Suggestions(items=assistant.clean_checklist(draft))


@router.post("/boards", status_code=201)
def board_starter(
    body: BoardPrompt, request: Request, user: CurrentUser, session: SessionDep
) -> BoardSummary:
    count = session.exec(select(func.count()).where(Board.owner_id == user.id)).one()
    limits.check(count, limits.BOARDS_PER_USER, "Limit reached: at most {cap} boards")
    messages = assistant.board_messages(body.description)
    draft = ai.complete(messages, assistant.BoardDraft, _key(request, user))
    board = build_from_data(session, user.id, assistant.clean_board(draft))
    return board_summary(board, Role.admin)


@router.post("/columns")
def suggest_columns(body: ColumnsPrompt, request: Request, user: CurrentUser) -> ColumnSuggestions:
    """Column names for each board name; never cards (T-725, T-726)."""
    try:
        messages = columns_ai.columns_messages(body.boards, body.workspace)
        draft = ai.complete(messages, columns_ai.ColumnsDraft, _key(request, user))
    except HTTPException as exc:
        if exc.status_code not in (429, 502):
            raise
        return ColumnSuggestions(boards=columns_ai.suggestions(body.boards, None), ai=False)
    return ColumnSuggestions(boards=columns_ai.suggestions(body.boards, draft), ai=True)


@router.post("/chat")
def chat(body: ChatRequest, request: Request, user: CurrentUser, session: SessionDep) -> ChatReply:
    board = board_full_for(session, user, body.board_id)
    history = [m.model_dump() for m in body.messages]
    draft = ai.complete(
        assistant.chat_messages(board, history), assistant.ChatDraft, _key(request, user)
    )
    return ChatReply(
        reply=draft.reply.strip()[:4000], actions=assistant.clean_actions(board, draft.actions)
    )
