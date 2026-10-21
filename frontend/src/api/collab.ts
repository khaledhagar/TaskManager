import { api } from './client'

export type Comment = {
  id: number
  card_id: number
  author_id: number
  author_email: string | null
  text: string
  created_at: string
  edited_at: string | null
}

export type ActivityEntry = {
  id: number
  kind: string
  data: Record<string, string | number | string[]>
  card_id: number | null
  actor_email: string | null
  created_at: string
}

export const collab = {
  comments: (cardId: number) => api<Comment[]>(`/cards/${cardId}/comments`),
  addComment: (cardId: number, text: string) => api<Comment>(`/cards/${cardId}/comments`, { body: { text } }),
  editComment: (id: number, text: string) => api<Comment>(`/comments/${id}`, { method: 'PATCH', body: { text } }),
  deleteComment: (id: number) => api<void>(`/comments/${id}`, { method: 'DELETE' }),

  /** Newest first; `before` pages to older entries; `cardId` gives one card's history. */
  activity: (boardId: number, options: { cardId?: number; before?: number; limit?: number } = {}) => {
    const query = new URLSearchParams()
    if (options.cardId) query.set('card_id', String(options.cardId))
    if (options.before) query.set('before', String(options.before))
    if (options.limit) query.set('limit', String(options.limit))
    const suffix = query.size ? `?${query}` : ''
    return api<ActivityEntry[]>(`/boards/${boardId}/activity${suffix}`)
  },
}
