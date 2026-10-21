import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { auth } from './api/auth'
import { boards } from './api/boards'
import { ApiError } from './api/client'
import App from './App'
import { I18nProvider } from './i18n/I18n'
import { applyLanguage } from './i18n/language'

vi.mock('./api/auth', async (original) => {
  const actual = await original<typeof import('./api/auth')>()
  return { ...actual, auth: { me: vi.fn(), config: vi.fn(), verify: vi.fn(), setLanguage: vi.fn() } }
})
vi.mock('./api/boards', () => ({ boards: { list: vi.fn(), get: vi.fn() } }))

const member = {
  id: 1,
  email: 'alice@example.com',
  is_guest: false,
  email_verified: true,
  has_password: true,
  google_linked: false,
  language: 'en' as const,
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  applyLanguage('en')
  vi.mocked(auth.config).mockResolvedValue({ google: false })
  vi.mocked(boards.list).mockResolvedValue([{ id: 1, title: 'Website Launch', created_at: '', role: 'admin' as const }])
  vi.mocked(boards.get).mockResolvedValue({ id: 1, title: 'Website Launch', labels: [], columns: [], background: { kind: 'none' as const, preset: null, version: 0 }, role: 'admin' as const, public: false, public_link: null, meeting_url: null, members: [] })
})

const renderApp = () =>
  render(
    <I18nProvider>
      <App />
    </I18nProvider>,
  )

describe('app routing', () => {
  test('signed-out visitors see sign in', async () => {
    history.replaceState(null, '', '/')
    vi.mocked(auth.me).mockRejectedValue(new ApiError(401, 'Not signed in'))
    renderApp()
    expect(
      await screen.findByRole('heading', { name: 'Sign in to Task Manager' }),
    ).toBeInTheDocument()
  })

  test('signed-in users see their board, even when opening /signin', async () => {
    history.replaceState(null, '', '/signin')
    vi.mocked(auth.me).mockResolvedValue(member)
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Website Launch' })).toBeInTheDocument()
    expect(location.pathname).toBe('/')
  })

  test('the verification link signs in and opens the app', async () => {
    history.replaceState(null, '', '/verify#token=tok-1234567890')
    vi.mocked(auth.me).mockRejectedValue(new ApiError(401, 'Not signed in'))
    vi.mocked(auth.verify).mockResolvedValue(member)
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Website Launch' })).toBeInTheDocument()
    expect(location.pathname).toBe('/')
  })
})

describe('language on the account (T-243)', () => {
  beforeEach(() => history.replaceState(null, '', '/'))

  test('a fresh browser takes the language saved on the account', async () => {
    vi.mocked(auth.me).mockResolvedValue({ ...member, language: 'ar' })
    renderApp()
    await waitFor(() => expect(document.documentElement.lang).toBe('ar'))
    expect(document.documentElement.dir).toBe('rtl')
    expect(auth.setLanguage).not.toHaveBeenCalled()
  })

  test('a choice saved in this browser is copied to the account', async () => {
    localStorage.setItem('language', 'ar')
    applyLanguage('ar')
    vi.mocked(auth.me).mockResolvedValue(member)
    vi.mocked(auth.setLanguage).mockResolvedValue({ ...member, language: 'ar' })
    renderApp()
    await waitFor(() => expect(auth.setLanguage).toHaveBeenCalledWith('ar'))
  })

  test('the header button saves the new language on the account', async () => {
    vi.mocked(auth.me).mockResolvedValue(member)
    vi.mocked(auth.setLanguage).mockResolvedValue({ ...member, language: 'ar' })
    renderApp()
    await userEvent.click(await screen.findByRole('button', { name: 'العربية' }))
    expect(auth.setLanguage).toHaveBeenCalledWith('ar')
    expect(document.documentElement.lang).toBe('ar')
  })
})
