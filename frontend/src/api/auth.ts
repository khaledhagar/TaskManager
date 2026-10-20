import type { Language } from '../i18n/messages'
import { api } from './client'

export type User = {
  id: number
  email: string | null
  is_guest: boolean
  email_verified: boolean
  has_password: boolean
  google_linked: boolean
  language: Language
}

export type Pending = { email: string; verification_required: true }
type Answer = { detail: string }
type Credentials = { email: string; password: string }

export const auth = {
  config: () => api<{ google: boolean }>('/auth/config'),
  me: () => api<User>('/auth/me'),
  signUp: (body: Credentials) => api<Pending>('/auth/signup', { body }),
  signIn: (body: Credentials) => api<User>('/auth/signin', { body }),
  guest: () => api<User>('/auth/guest', { method: 'POST' }),
  upgrade: (body: Credentials) => api<Pending>('/auth/upgrade', { body }),
  signOut: () => api<void>('/auth/signout', { method: 'POST' }),
  setLanguage: (language: Language) => api<User>('/auth/me', { method: 'PATCH', body: { language } }),
  deleteAccount: () => api<void>('/auth/me', { method: 'DELETE' }),
  verify: (token: string) => api<User>('/auth/verify', { body: { token } }),
  resend: (email: string) => api<Answer>('/auth/resend-verification', { body: { email } }),
  forgot: (email: string) => api<Answer>('/auth/forgot-password', { body: { email } }),
  reset: (token: string, password: string) =>
    api<User>('/auth/reset-password', { body: { token, password } }),
  changePassword: (current_password: string | null, new_password: string) =>
    api<User>('/auth/change-password', { body: { current_password, new_password } }),
}

export const GOOGLE_LOGIN_URL = '/api/auth/google/login'
