import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { Board } from '../api/boards'
import { BoardColumns } from './BoardColumns'
import { EMPTY_FILTERS } from './logic'
import type { BoardActions } from './useBoard'

const card = (id: number, title: string) => ({
  id, title, details: '', completed: false, priority: 'medium' as const, due_date: null,
  position: 0, label_ids: [], checklist: [], attachments: [], assignee_ids: [],
})
const board: Board = {
  id: 1,
  title: 'B',
  labels: [],
  background: { kind: 'none', preset: null, version: 0 }, role: 'admin' as const, public: false, public_link: null, meeting_url: null, members: [],
  columns: [{ id: 1, title: 'To Do', position: 0, cards: [card(10, 'Write post')] }],
}

function renderBoard() {
  render(
    <BoardColumns
      board={board}
      actions={{} as BoardActions}
      filters={EMPTY_FILTERS}
      dragDisabled={false}
      composingColumn={null}
      onCompose={vi.fn()}
      onOpenCard={vi.fn()}
    />,
  )
  return screen.getByRole('button', { name: /Write post/ })
}

const touch = (x: number, y: number) => ({ touches: [{ clientX: x, clientY: y }] })
/** While a card is dragged, the drag overlay shows a second copy of it. */
const lifted = () => screen.getAllByText('Write post').length === 2

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('touch drag and drop (NFR-24)', () => {
  test('pressing and holding a card picks it up', () => {
    const handle = renderBoard()
    fireEvent.touchStart(handle, touch(50, 50))
    act(() => vi.advanceTimersByTime(300))
    expect(lifted()).toBe(true)
  })

  test('a quick swipe scrolls instead of picking the card up', () => {
    const handle = renderBoard()
    fireEvent.touchStart(handle, touch(50, 50))
    act(() => vi.advanceTimersByTime(60))
    fireEvent.touchMove(handle, touch(50, 120))
    act(() => vi.advanceTimersByTime(400))
    expect(lifted()).toBe(false)
  })
})
