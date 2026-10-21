import { act, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { boards, type Board } from '../api/boards'
import { ApiError } from '../api/client'
import { ToastProvider } from '../ui/Toast'
import { UNDO_MS, useBoard } from './useBoard'

vi.mock('../api/boards', () => ({
  boards: { get: vi.fn(), removeCard: vi.fn(), moveCard: vi.fn(), updateCard: vi.fn(), removeColumn: vi.fn() },
}))

function sample(): Board {
  const card = (id: number) => ({
    id,
    title: `Card ${id}`,
    details: '',
    completed: false,
    priority: 'medium' as const,
    due_date: null,
    position: 0,
    label_ids: [],
    checklist: [],
    attachments: [], assignee_ids: [],
  })
  return {
    id: 1,
    title: 'B',
    background: { kind: 'none' as const, preset: null, version: 0 }, role: 'admin' as const, public: false, public_link: null, meeting_url: null, members: [],
    labels: [],
    columns: [
      { id: 1, title: 'To Do', position: 0, cards: [card(1), card(2)] },
      { id: 2, title: 'Done', position: 1, cards: [] },
    ],
  }
}

const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>
const cardIds = (b: Board | null, col: number) => b!.columns[col].cards.map((c) => c.id)

async function setup() {
  const hook = renderHook(() => useBoard(1), { wrapper })
  await waitFor(() => expect(hook.result.current.board).not.toBeNull())
  return hook
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(boards.get).mockResolvedValue(sample())
})
afterEach(() => vi.useRealTimers())

describe('undo delete (T-210)', () => {
  test('the card disappears at once and is deleted on the server after 5 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.mocked(boards.removeCard).mockResolvedValue(undefined)
    const { result } = await setup()
    act(() => result.current.actions.deleteCard(1))
    expect(cardIds(result.current.board, 0)).toEqual([2])
    expect(boards.removeCard).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(UNDO_MS + 10))
    expect(boards.removeCard).toHaveBeenCalledWith(1)
  })

  test('Undo puts the card back in place and nothing is deleted', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { result } = await setup()
    act(() => result.current.actions.deleteCard(1))
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(cardIds(result.current.board, 0)).toEqual([1, 2])
    await act(() => vi.advanceTimersByTimeAsync(UNDO_MS + 10))
    expect(boards.removeCard).not.toHaveBeenCalled()
  })

  test('leaving the board carries out waiting deletes', async () => {
    vi.mocked(boards.removeColumn).mockResolvedValue(undefined)
    const { result, unmount } = await setup()
    act(() => result.current.actions.deleteColumn(2))
    unmount()
    expect(boards.removeColumn).toHaveBeenCalledWith(2)
  })
})

describe('optimistic updates (T-215)', () => {
  test('a move shows at once and is sent to the server', async () => {
    vi.mocked(boards.moveCard).mockResolvedValue(sample().columns[0].cards[0])
    const { result } = await setup()
    await act(async () => {
      await result.current.actions.moveCard(1, 2, 0)
    })
    expect(cardIds(result.current.board, 1)).toEqual([1])
    expect(boards.moveCard).toHaveBeenCalledWith(1, 2, 0)
  })

  test('a failed move rolls back, shows the error and reloads', async () => {
    vi.mocked(boards.moveCard).mockRejectedValue(new ApiError(500, 'Server unavailable'))
    const { result } = await setup()
    await act(async () => {
      await result.current.actions.moveCard(1, 2, 0)
    })
    expect(cardIds(result.current.board, 0)).toEqual([1, 2])
    expect(cardIds(result.current.board, 1)).toEqual([])
    expect(await screen.findByText('Server unavailable')).toBeInTheDocument()
    expect(boards.get).toHaveBeenCalledTimes(2)
  })
})
