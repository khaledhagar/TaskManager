import type { BoardSummary } from './boards'
import { api } from './client'

/** A private group of the user's related boards. */
export type Workspace = { id: number; name: string; created_at: string }
export type NewBoard = { title: string; columns: string[] }
export type BoardMembers = { board_id: number; title: string; members: { email: string | null; role: string }[] }

export const workspaces = {
  list: () => api<Workspace[]>('/workspaces'),
  create: (name: string, boards: NewBoard[]) =>
    api<{ workspace: Workspace; boards: BoardSummary[] }>('/workspaces', { body: { name, boards } }),
  rename: (id: number, name: string) => api<Workspace>(`/workspaces/${id}`, { method: 'PATCH', body: { name } }),
  remove: (id: number) => api<void>(`/workspaces/${id}`, { method: 'DELETE' }),
  /** Members of your boards in a workspace, or in none ('none'), board by board. */
  members: (id: number | 'none') => api<BoardMembers[]>(`/workspaces/${id}/members`),
}
