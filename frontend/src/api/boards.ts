import { api } from './client'

export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export type Template = 'blank' | 'sprint' | 'bug_tracking' | 'personal'
export type LabelColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'gray'

/** A member's permission: Viewer, Can update tasks, Full access, or Admin (the board's creator). */
export type Role = 'viewer' | 'updater' | 'editor' | 'admin'
export type BoardSummary = {
  id: number
  title: string
  created_at: string
  role: Role
  archived?: boolean
  starred?: boolean
}
export type Label = { id: number; name: string; color: LabelColor }
export type ChecklistItem = { id: number; text: string; done: boolean; position: number }
export type Attachment = {
  id: number
  filename: string
  content_type: string
  size: number
  is_image: boolean
  created_at: string
}
export type Background = { kind: 'none' | 'preset' | 'image'; preset: string | null; version: number }
export type Card = {
  id: number
  title: string
  details: string
  completed: boolean
  priority: Priority
  due_date: string | null
  position: number
  label_ids: number[]
  checklist: ChecklistItem[]
  attachments: Attachment[]
  assignee_ids: number[]
  /** Sent with the board; 0 when a single card comes back. */
  comment_count?: number
  cover_attachment_id?: number | null
  focus_count?: number
  focus_minutes?: number
}
export type Column = { id: number; title: string; position: number; wip_limit?: number | null; cards: Card[] }
export type ArchivedCard = { id: number; title: string; column_id: number; column_title: string; archived_at: string }
export type UserTemplate = { id: number; name: string; created_at: string }
export type FocusStats = { focus_count: number; focus_minutes: number }
export type Board = {
  id: number
  title: string
  labels: Label[]
  columns: Column[]
  background: Background
  role: Role
  /** Anyone with the link can view; only the admin gets the link itself. */
  public: boolean
  public_link: string | null
  meeting_url: string | null
  members: { user_id: number; email: string | null }[]
  archived?: boolean
  auto_complete?: boolean
}
export type CardPatch = Partial<
  Pick<Card, 'title' | 'details' | 'completed' | 'priority' | 'due_date'>
>

const del = (path: string) => api<void>(path, { method: 'DELETE' })
const patch = <T>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body })

export const boards = {
  list: () => api<BoardSummary[]>('/boards'),
  get: (id: number) => api<Board>(`/boards/${id}`),
  create: (title: string, template: Template = 'blank') =>
    api<BoardSummary>('/boards', { body: { title, template } }),
  createFromTemplate: (title: string, templateId: number) =>
    api<BoardSummary>('/boards', { body: { title, template_id: templateId } }),
  setAutoComplete: (id: number, on: boolean) => patch<BoardSummary>(`/boards/${id}`, { auto_complete: on }),
  archive: (id: number) => api<BoardSummary>(`/boards/${id}/archive`, { method: 'POST' }),
  restore: (id: number) => api<BoardSummary>(`/boards/${id}/restore`, { method: 'POST' }),
  duplicate: (id: number) => api<BoardSummary>(`/boards/${id}/duplicate`, { method: 'POST' }),
  star: (id: number, on: boolean) => api<void>(`/boards/${id}/star`, { method: on ? 'PUT' : 'DELETE' }),
  archived: (id: number) => api<ArchivedCard[]>(`/boards/${id}/archived`),
  rename: (id: number, title: string) => patch<BoardSummary>(`/boards/${id}`, { title }),
  remove: (id: number) => del(`/boards/${id}`),

  addColumn: (boardId: number, title: string) =>
    api<Column>(`/boards/${boardId}/columns`, { body: { title } }),
  renameColumn: (id: number, title: string) => patch<Column>(`/columns/${id}`, { title }),
  setWipLimit: (id: number, limit: number | null) => patch<Column>(`/columns/${id}`, { wip_limit: limit }),
  removeColumn: (id: number) => del(`/columns/${id}`),
  reorderColumns: (boardId: number, columnIds: number[]) =>
    api<void>(`/boards/${boardId}/columns/order`, { body: { column_ids: columnIds } }),

  addCard: (columnId: number, title: string) =>
    api<Card>(`/columns/${columnId}/cards`, { body: { title } }),
  updateCard: (id: number, changes: CardPatch) => patch<Card>(`/cards/${id}`, changes),
  removeCard: (id: number) => del(`/cards/${id}`),
  archiveCard: (id: number) => api<void>(`/cards/${id}/archive`, { method: 'POST' }),
  restoreCard: (id: number) => api<Card>(`/cards/${id}/restore`, { method: 'POST' }),
  duplicateCard: (id: number) => api<Card>(`/cards/${id}/duplicate`, { method: 'POST' }),
  setCover: (id: number, attachmentId: number | null) =>
    api<Card>(`/cards/${id}/cover`, { method: 'PUT', body: { attachment_id: attachmentId } }),
  addFocus: (id: number, minutes: number) => api<FocusStats>(`/cards/${id}/focus-sessions`, { body: { minutes } }),
  moveCard: (id: number, columnId: number, position: number) =>
    api<Card>(`/cards/${id}/move`, { body: { column_id: columnId, position } }),
  setCardLabels: (id: number, labelIds: number[]) =>
    api<Card>(`/cards/${id}/labels`, { method: 'PUT', body: { label_ids: labelIds } }),
  setAssignees: (id: number, userIds: number[]) =>
    api<Card>(`/cards/${id}/assignees`, { method: 'PUT', body: { user_ids: userIds } }),

  addItem: (cardId: number, text: string) =>
    api<ChecklistItem>(`/cards/${cardId}/checklist`, { body: { text } }),
  updateItem: (id: number, changes: Partial<Pick<ChecklistItem, 'text' | 'done'>>) =>
    patch<ChecklistItem>(`/checklist/${id}`, changes),
  removeItem: (id: number) => del(`/checklist/${id}`),

  addLabel: (boardId: number, name: string, color: LabelColor) =>
    api<Label>(`/boards/${boardId}/labels`, { body: { name, color } }),
  removeLabel: (id: number) => del(`/labels/${id}`),
}
