import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { User } from '../api/auth'
import { ApiError } from '../api/client'
import { sharing } from '../api/sharing'
import { BoardSwitcher } from '../shell/BoardSwitcher'
import { InvitePage } from './InvitePage'
import { savedInvite } from './inviteStore'

vi.mock('../api/sharing', () => ({ sharing: { preview: vi.fn(), accept: vi.fn() } }))

const bob: User = {
  id: 2,
  email: 'bob@example.com',
  is_guest: false,
  email_verified: true,
  has_password: true,
  google_linked: false,
  language: 'en',
}
const preview = { board_title: 'Launch', invited_by: 'alice@example.com', email: 'bob@example.com' }

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  history.replaceState(null, '', '/invite#token=abc')
  vi.mocked(sharing.preview).mockResolvedValue(preview)
})

describe('invite page (T-544, T-545)', () => {
  test('shows the board and inviter; Accept opens the board', async () => {
    vi.mocked(sharing.accept).mockResolvedValue({ id: 5, title: 'Launch', created_at: '', role: 'viewer' })
    render(<InvitePage user={bob} onSignOut={vi.fn()} />)
    expect(await screen.findByText('alice@example.com invited you to join "Launch".')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Accept invitation' }))
    expect(sharing.accept).toHaveBeenCalledWith('abc')
    expect(location.pathname + location.search).toBe('/?board=5')
  })

  test('another account sees the server message and can switch accounts', async () => {
    const message = 'This invitation was sent to bob@example.com. Sign in with that address to accept it.'
    vi.mocked(sharing.accept).mockRejectedValue(new ApiError(403, message))
    const onSignOut = vi.fn()
    render(<InvitePage user={{ ...bob, email: 'carol@example.com' }} onSignOut={onSignOut} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Accept invitation' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    await userEvent.click(screen.getByRole('button', { name: 'Sign out and use another account' }))
    expect(onSignOut).toHaveBeenCalled()
  })

  test('a signed-out visitor is offered sign in or sign up, and the invite is remembered', async () => {
    render(<InvitePage user={null} onSignOut={vi.fn()} />)
    expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/signin')
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/signup')
    expect(savedInvite()).toBe('abc')
  })

  test('an expired or used link says so', async () => {
    vi.mocked(sharing.preview).mockRejectedValue(new ApiError(400, 'invalid'))
    localStorage.setItem('inviteToken', 'abc')
    render(<InvitePage user={bob} onSignOut={vi.fn()} />)
    expect(await screen.findByText('This invitation link is invalid or has expired.')).toBeInTheDocument()
    expect(savedInvite()).toBeNull()
  })
})

describe('board switcher (T-549)', () => {
  test('groups your boards and boards shared with you', async () => {
    const list = [
      { id: 1, title: 'Mine', created_at: '', role: 'admin' as const },
      { id: 2, title: 'Team plan', created_at: '', role: 'editor' as const },
    ]
    render(<BoardSwitcher boards={list} selectedId={1} onSelect={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Mine, switch board' }))
    const items = screen.getAllByRole('menu')[0].textContent
    expect(items).toMatch(/Your boards.*Mine.*Shared with you.*Team plan/)
  })
})
