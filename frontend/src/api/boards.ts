import { api } from './client'

export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export type LabelColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'gray'

export type BoardSummary = { id: number; title: string; created_at: string }
export type Label = { id: number; name: string; color: LabelColor }
export type ChecklistItem = { id: number; text: string; done: boolean; position: number }
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
}
export type Column = { id: number; title: string; position: number; cards: Card[] }
export type Board = { id: number; title: string; labels: Label[]; columns: Column[] }

export const boards = {
  list: () => api<BoardSummary[]>('/boards'),
  get: (id: number) => api<Board>(`/boards/${id}`),
  create: (title: string) => api<BoardSummary>('/boards', { body: { title } }),
}
