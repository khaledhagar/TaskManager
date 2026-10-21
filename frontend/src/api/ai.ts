import type { BoardSummary } from './boards'
import { api } from './client'

export type ChatMessage = { role: 'user' | 'assistant'; content: string }
export type ChatAction = {
  type: 'create_card' | 'move_card' | 'complete_card'
  card_id: number | null
  column_id: number | null
  title: string | null
}
export type ChatReply = { reply: string; actions: ChatAction[] }
/** `ai` is false when the AI was unavailable and the default columns came back. */
export type ColumnSuggestions = { boards: { title: string; columns: string[] }[]; ai: boolean }

/** How many recent messages are sent with each chat request (the server keeps 20). */
export const CHAT_HISTORY = 20

/** AI calls take several seconds, so each one can be cancelled with an AbortSignal. */
export const ai = {
  suggestChecklist: (cardId: number, signal?: AbortSignal) =>
    api<{ items: string[] }>(`/ai/cards/${cardId}/checklist`, { method: 'POST', signal }),
  startBoard: (description: string, signal?: AbortSignal) =>
    api<BoardSummary>('/ai/boards', { body: { description }, signal }),
  suggestColumns: (boards: string[], workspace: string | null, signal?: AbortSignal) =>
    api<ColumnSuggestions>('/ai/columns', { body: { boards, workspace }, signal }),
  chat: (boardId: number, messages: ChatMessage[], signal?: AbortSignal) =>
    api<ChatReply>('/ai/chat', {
      body: { board_id: boardId, messages: messages.slice(-CHAT_HISTORY) },
      signal,
    }),
}
