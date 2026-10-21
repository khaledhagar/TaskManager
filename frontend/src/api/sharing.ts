import type { BoardSummary, Role } from './boards'
import { api } from './client'

export type Member = { user_id: number; email: string | null; role: Role }
export type PendingInvite = { id: number; email: string; expires_at: string }
export type AccessRequest = { id: number; user_id: number; email: string | null; role: Role; created_at: string }
export type Members = {
  role: Role
  members: Member[]
  invites: PendingInvite[]
  requests: AccessRequest[]
  requested: boolean
}
export type InviteLink = PendingInvite & { link: string }
export type InvitePreview = { board_title: string; invited_by: string | null; email: string }

export const sharing = {
  members: (boardId: number) => api<Members>(`/boards/${boardId}/members`),
  changeRole: (boardId: number, userId: number, role: Role) =>
    api<Member>(`/boards/${boardId}/members/${userId}`, { method: 'PATCH', body: { role } }),
  remove: (boardId: number, userId: number) =>
    api<void>(`/boards/${boardId}/members/${userId}`, { method: 'DELETE' }),

  invite: (boardId: number, email: string) => api<InviteLink>(`/boards/${boardId}/invites`, { body: { email } }),
  resend: (inviteId: number) => api<InviteLink>(`/invites/${inviteId}/resend`, { method: 'POST' }),
  cancel: (inviteId: number) => api<void>(`/invites/${inviteId}`, { method: 'DELETE' }),
  preview: (token: string) => api<InvitePreview>('/invites/preview', { body: { token } }),
  accept: (token: string) => api<BoardSummary>('/invites/accept', { body: { token } }),

  requestAccess: (boardId: number) => api<{ id: number }>(`/boards/${boardId}/access-requests`, { method: 'POST' }),
  approve: (requestId: number, role: Role) =>
    api<Member>(`/access-requests/${requestId}/approve`, { body: { role } }),
  decline: (requestId: number) => api<void>(`/access-requests/${requestId}`, { method: 'DELETE' }),
}

/** WhatsApp share link with a short message and the invite link (opens the app or web). */
export function whatsAppLink(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}
