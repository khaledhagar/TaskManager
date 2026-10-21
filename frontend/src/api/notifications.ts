import { api } from './client'

export type Notice = {
  id: number
  kind: 'assigned' | 'mentioned' | 'due_soon' | 'overdue'
  board_id: number
  card_id: number | null
  actor_email: string | null
  data: { title?: string; board?: string }
  created_at: string
  read: boolean
}

export const notifications = {
  list: () => api<{ unread: number; items: Notice[] }>('/notifications'),
  read: (id: number) => api<void>(`/notifications/${id}/read`, { method: 'POST' }),
  readAll: () => api<void>('/notifications/read-all', { method: 'POST' }),
  settings: () => api<{ email: boolean }>('/notifications/settings'),
  setEmail: (email: boolean) => api<{ email: boolean }>('/notifications/settings', { method: 'PATCH', body: { email } }),
  unsubscribe: (token: string) => api<void>('/notifications/unsubscribe', { body: { token } }),
}
