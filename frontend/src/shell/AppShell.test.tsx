import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { auth, type User } from '../api/auth'
import { boards } from '../api/boards'
import { AppShell } from './AppShell'

vi.mock('../api/auth', async (original) => {
  const actual = await original<typeof import('../api/auth')>()
  return {
    ...actual,
    auth: {
      config: vi.fn(),
      signOut: vi.fn(),
      deleteAccount: vi.fn(),
      changePassword: vi.fn(),
      upgrade: vi.fn(),
    },
  }
})
vi.mock('../api/boards', () => ({ boards: { list: vi.fn(), create: vi.fn(), get: vi.fn() } }))

const member: User = {
  id: 1,
  email: 'alice@example.com',
  is_guest: false,
  email_verified: true,
  has_password: true,
  google_linked: false,
  language: 'en',
}
const LIST = [
  { id: 1, title: 'Website Launch', created_at: '2026-10-20T00:00:00', role: 'admin' as const },
  { id: 2, title: 'Personal', created_at: '2026-10-20T00:00:01', role: 'admin' as const },
]

function boardFor(id: number) {
  const title = LIST.find((b) => b.id === id)?.title ?? 'New'
  return {
    id,
    title,
    labels: [],
    columns: [{ id: 1, title: 'To Do', position: 0, cards: [] }],
    background: { kind: 'none' as const, preset: null, version: 0 }, role: 'admin' as const, public: false, public_link: null, meeting_url: null, members: [],
  }
}

function renderShell(user: User = member, props: Partial<Parameters<typeof AppShell>[0]> = {}) {
  return render(
    <AppShell user={user} onUserChange={vi.fn()} onSignedOut={vi.fn()} {...props} />,
  )
}

async function openAccountMenu() {
  await userEvent.click(screen.getByRole('button', { name: 'Account' }))
  return screen.getByRole('menu', { name: 'Account' })
}

beforeEach(() => {
  vi.clearAllMocks()
  history.replaceState(null, '', '/')
  vi.mocked(auth.config).mockResolvedValue({ google: false })
  vi.mocked(boards.list).mockResolvedValue(LIST)
  vi.mocked(boards.get).mockImplementation(async (id) => boardFor(id))
})

describe('app shell', () => {
  test('opens the first board and switches boards', async () => {
    renderShell()
    expect(await screen.findByRole('heading', { name: 'Website Launch' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Website Launch, switch board' }))
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Personal' }))
    expect(await screen.findByRole('heading', { name: 'Personal' })).toBeInTheDocument()
    expect(location.search).toBe('?board=2')
  })

  test('creates a new board and opens it', async () => {
    vi.mocked(boards.create).mockResolvedValue({ id: 3, title: 'Q4 Roadmap', created_at: '', role: 'admin' as const })
    renderShell()
    await screen.findByRole('heading', { name: 'Website Launch' })
    await userEvent.click(screen.getByRole('button', { name: 'New board' }))
    const dialog = screen.getByRole('dialog', { name: 'New board' })
    await userEvent.type(within(dialog).getByLabelText('Board name'), 'Q4 Roadmap')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create board' }))
    expect(boards.create).toHaveBeenCalledWith('Q4 Roadmap', 'blank')
    expect(location.search).toBe('?board=3')
  })

  test('theme toggle switches the theme', async () => {
    renderShell()
    const toggle = screen.getByRole('button', { name: /switch to (dark|light) theme/i })
    const before = document.documentElement.dataset.theme
    await userEvent.click(toggle)
    expect(document.documentElement.dataset.theme).not.toBe(before)
  })

  test('sign out calls the API and reports it', async () => {
    const onSignedOut = vi.fn()
    renderShell(member, { onSignedOut })
    await userEvent.click(within(await openAccountMenu()).getByRole('menuitem', { name: 'Sign out' }))
    expect(auth.signOut).toHaveBeenCalled()
    expect(onSignedOut).toHaveBeenCalled()
  })

  test('delete account asks first', async () => {
    const onSignedOut = vi.fn()
    renderShell(member, { onSignedOut })
    await userEvent.click(
      within(await openAccountMenu()).getByRole('menuitem', { name: 'Delete account' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Delete your account?' })
    expect(auth.deleteAccount).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete account' }))
    expect(auth.deleteAccount).toHaveBeenCalled()
    expect(onSignedOut).toHaveBeenCalled()
  })
})

describe('account menu password options (T-220)', () => {
  test('members with a password see Change password and must give the current one', async () => {
    vi.mocked(auth.changePassword).mockResolvedValue(member)
    renderShell()
    const menu = await openAccountMenu()
    expect(within(menu).getByText('alice@example.com')).toBeInTheDocument()
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Change password' }))
    const dialog = screen.getByRole('dialog', { name: 'Change password' })
    await userEvent.type(within(dialog).getByLabelText('Current password'), 'correct-horse')
    await userEvent.type(within(dialog).getByLabelText('New password'), 'brand-new-pass')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save password' }))
    expect(auth.changePassword).toHaveBeenCalledWith('correct-horse', 'brand-new-pass')
    expect(await within(dialog).findByRole('status')).toHaveTextContent(/other devices/i)
  })

  test('Google-only users see Set password without a current password', async () => {
    vi.mocked(auth.changePassword).mockResolvedValue({ ...member, has_password: true })
    renderShell({ ...member, has_password: false, google_linked: true })
    const menu = await openAccountMenu()
    expect(within(menu).queryByRole('menuitem', { name: 'Change password' })).toBeNull()
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Set password' }))
    const dialog = screen.getByRole('dialog', { name: 'Set password' })
    expect(within(dialog).queryByLabelText('Current password')).toBeNull()
    await userEvent.type(within(dialog).getByLabelText('New password'), 'brand-new-pass')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save password' }))
    expect(auth.changePassword).toHaveBeenCalledWith(null, 'brand-new-pass')
  })

  test('guests are offered to save their boards instead', async () => {
    vi.mocked(auth.upgrade).mockResolvedValue({ email: 'g@example.com', verification_required: true })
    renderShell({ ...member, email: null, is_guest: true, has_password: false })
    expect(screen.getByText(/guest boards are removed after 7 days/i)).toBeInTheDocument()
    const menu = await openAccountMenu()
    expect(within(menu).queryByRole('menuitem', { name: /password/i })).toBeNull()
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Save your boards' }))
    const dialog = screen.getByRole('dialog', { name: 'Save your boards' })
    await userEvent.type(within(dialog).getByLabelText('Email'), 'g@example.com')
    await userEvent.type(within(dialog).getByLabelText('Password'), 'correct-horse')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create account' }))
    expect(auth.upgrade).toHaveBeenCalledWith({ email: 'g@example.com', password: 'correct-horse' })
    expect(await within(dialog).findByRole('status')).toHaveTextContent('g@example.com')
  })
})
