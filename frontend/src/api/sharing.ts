import type { Background, BoardSummary, Card, Label, Role } from './boards'
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
type PublicCard = Omit<Card, 'attachments' | 'assignee_ids' | 'position'>
/** What anyone with a public link sees: no board id, members, files or AI. */
export type PublicBoard = {
  title: string
  labels: Label[]
  columns: { id: number; title: string; cards: PublicCard[] }[]
  background: Background
}

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

  setVisibility: (boardId: number, isPublic: boolean) =>
    api<{ public: boolean; link: string | null }>(`/boards/${boardId}/visibility`, {
      method: 'PUT',
      body: { public: isPublic },
    }),
  publicBoard: (token: string) => api<PublicBoard>(`/public/boards/${token}`),
  publicBackground: (token: string) => `/api/public/boards/${token}/background`,
  joinPublic: (token: string) => api<BoardSummary>(`/public/boards/${token}/join`, { method: 'POST' }),

  setMeeting: (boardId: number, url: string | null) =>
    api<{ url: string | null }>(`/boards/${boardId}/meeting`, { method: 'PUT', body: { url } }),
  emailMeeting: (boardId: number) => api<{ sent: number }>(`/boards/${boardId}/meeting/email`, { method: 'POST' }),
}

/** WhatsApp share link with a short message and the invite link (opens the app or web). */
export function whatsAppLink(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}
