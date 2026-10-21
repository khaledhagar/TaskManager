import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { User } from '../api/auth'
import { ApiError } from '../api/client'
import { sharing, type PublicBoard } from '../api/sharing'
import { takeReturn } from './inviteStore'
import { PublicBoardPage } from './PublicBoardPage'

vi.mock('../api/sharing', () => ({
  sharing: { publicBoard: vi.fn(), joinPublic: vi.fn(), publicBackground: (t: string) => `/api/public/boards/${t}/background` },
}))

const board: PublicBoard = {
  title: 'Open roadmap',
  labels: [],
  background: { kind: 'none', preset: null, version: 0 },
  columns: [
    {
      id: 1,
      title: 'To Do',
      cards: [{ id: 3, title: 'Ship it', details: '', completed: true, priority: 'high', due_date: null, label_ids: [], checklist: [] }],
    },
  ],
}
const bob: User = {
  id: 2, email: 'bob@example.com', is_guest: false, email_verified: true,
  has_password: true, google_linked: false, language: 'en',
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  vi.mocked(sharing.publicBoard).mockResolvedValue(board)
})

describe('public board page (T-577)', () => {
  test('shows the board read-only: no buttons on cards, View only', async () => {
    render(<PublicBoardPage token="abc" user={null} />)
    expect(await screen.findByRole('heading', { name: 'Open roadmap' })).toBeInTheDocument()
    expect(screen.getByText('View only')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'To Do' })).toHaveTextContent('Ship it')
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByRole('button', { name: /Ship it/ })).toBeNull()
    expect(screen.getByText('Completed', { exact: false })).toBeInTheDocument()
  })

  test('a signed-out visitor is offered sign in, and comes back here afterwards', async () => {
    render(<PublicBoardPage token="abc" user={null} />)
    expect(await screen.findByRole('link', { name: 'Sign in to join' })).toHaveAttribute('href', '/signin')
    expect(takeReturn()).toBe('/p/abc')
  })

  test('a signed-in visitor joins and the board opens', async () => {
    vi.mocked(sharing.joinPublic).mockResolvedValue({ id: 9, title: 'Open roadmap', created_at: '', role: 'viewer' })
    render(<PublicBoardPage token="abc" user={bob} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Join board' }))
    expect(sharing.joinPublic).toHaveBeenCalledWith('abc')
    expect(location.pathname + location.search).toBe('/?board=9')
  })

  test('a private or changed link says so', async () => {
    vi.mocked(sharing.publicBoard).mockRejectedValue(new ApiError(404, 'Not found'))
    render(<PublicBoardPage token="old" user={null} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('This board is not public, or its link has changed.')
  })
})
