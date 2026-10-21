import { api } from './client'
import type { UserTemplate } from './boards'

/** Boards saved by the user as private templates (at most 20). */
export const templates = {
  list: () => api<UserTemplate[]>('/templates'),
  save: (boardId: number, name: string) => api<UserTemplate>('/templates', { body: { board_id: boardId, name } }),
  remove: (id: number) => api<void>(`/templates/${id}`, { method: 'DELETE' }),
}
