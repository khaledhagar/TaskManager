import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { notifications, type Notice } from '../api/notifications'
import { NotificationBell } from './NotificationBell'
import { UnsubscribePage } from './UnsubscribePage'

vi.mock('../api/notifications', () => ({
  notifications: { list: vi.fn(), read: vi.fn(), readAll: vi.fn(), unsubscribe: vi.fn() },
}))

const notice = (id: number, kind: Notice['kind'], read = false): Notice => ({
  id,
  kind,
  board_id: 4,
  card_id: 9,
  actor_email: 'bob@example.com',
  data: { title: 'Fix checkout', board: 'Launch' },
  created_at: new Date().toISOString(),
  read,
})

beforeEach(() => {
  vi.clearAllMocks()
  history.replaceState(null, '', '/')
  vi.mocked(notifications.list).mockResolvedValue({
    unread: 2,
    items: [notice(2, 'mentioned'), notice(1, 'assigned'), notice(0, 'overdue', true)],
  })
  vi.mocked(notifications.read).mockResolvedValue(undefined)
  vi.mocked(notifications.readAll).mockResolvedValue(undefined)
})

describe('notification bell (T-667, T-668)', () => {
  test('shows the unread count and lists notifications as sentences', async () => {
    render(<NotificationBell />)
    const bell = await screen.findByRole('button', { name: 'Notifications, 2 unread' })
    await userEvent.click(bell)
    expect(screen.getByText('bob@example.com mentioned you on "Fix checkout"')).toBeInTheDocument()
    expect(screen.getByText('bob@example.com assigned you to "Fix checkout" on Launch')).toBeInTheDocument()
    expect(screen.getByText('"Fix checkout" on Launch is overdue')).toBeInTheDocument()
  })

  test('opening one marks it read and opens its card', async () => {
    render(<NotificationBell />)
    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 2 unread' }))
    await userEvent.click(screen.getByRole('button', { name: /mentioned you/ }))
    expect(notifications.read).toHaveBeenCalledWith(2)
    expect(location.pathname + location.search).toBe('/?board=4&card=9')
  })

  test('Mark all as read', async () => {
    render(<NotificationBell />)
    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 2 unread' }))
    await userEvent.click(screen.getByRole('button', { name: 'Mark all as read' }))
    expect(notifications.readAll).toHaveBeenCalled()
  })

  test('refreshes on load, on tab focus and on opening; never on a timer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<NotificationBell />)
    await waitFor(() => expect(notifications.list).toHaveBeenCalledTimes(1))
    vi.advanceTimersByTime(10 * 60_000)
    expect(notifications.list).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new Event('focus'))
    expect(notifications.list).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
})

describe('unsubscribe page (T-663)', () => {
  test('turns emails off from the link', async () => {
    vi.mocked(notifications.unsubscribe).mockResolvedValue(undefined)
    history.replaceState(null, '', '/unsubscribe#token=5.abc')
    render(<UnsubscribePage />)
    expect(await screen.findByText(/Emails from Task Manager are turned off/)).toBeInTheDocument()
    expect(notifications.unsubscribe).toHaveBeenCalledWith('5.abc')
  })

  test('a bad link says so', async () => {
    vi.mocked(notifications.unsubscribe).mockRejectedValue(new Error('bad'))
    history.replaceState(null, '', '/unsubscribe#token=nope')
    render(<UnsubscribePage />)
    expect(await screen.findByText('This link is invalid.')).toBeInTheDocument()
  })
})
