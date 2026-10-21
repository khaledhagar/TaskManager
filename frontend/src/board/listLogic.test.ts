import { describe, expect, test } from 'vitest'
import type { Board, Card } from '../api/boards'
import { listRows, nextSort, sortRows } from './listLogic'
import { EMPTY_FILTERS } from './logic'

const card = (id: number, extra: Partial<Card> = {}): Card => ({
  id,
  title: `Card ${id}`,
  details: '',
  completed: false,
  priority: 'medium',
  due_date: null,
  position: 0,
  label_ids: [],
  checklist: [],
  attachments: [],
  assignee_ids: [],
  ...extra,
})

const board = {
  columns: [
    { id: 1, title: 'To Do', position: 0, cards: [card(1, { title: 'beta', priority: 'low', due_date: '2026-11-02' }), card(2, { title: 'Alpha', priority: 'urgent' })] },
    { id: 2, title: 'Done', position: 1, cards: [card(3, { title: 'gamma', completed: true, due_date: '2026-10-30' })] },
  ],
} as Board

const ids = (rows: ReturnType<typeof listRows>) => rows.map((r) => r.card.id)

describe('list view rows (T-701)', () => {
  test('every card in board order, with its column', () => {
    const rows = listRows(board, EMPTY_FILTERS)
    expect(ids(rows)).toEqual([1, 2, 3])
    expect(rows[2].column.title).toBe('Done')
  })

  test('follows the board filters', () => {
    expect(ids(listRows(board, { ...EMPTY_FILTERS, text: 'alp' }))).toEqual([2])
    expect(ids(listRows(board, { ...EMPTY_FILTERS, status: 'done' }))).toEqual([3])
  })

  test('sorts by each column, both ways', () => {
    const rows = listRows(board, EMPTY_FILTERS)
    expect(ids(sortRows(rows, { key: 'title', dir: 'asc' }))).toEqual([2, 1, 3])
    expect(ids(sortRows(rows, { key: 'title', dir: 'desc' }))).toEqual([3, 1, 2])
    expect(ids(sortRows(rows, { key: 'priority', dir: 'asc' }))).toEqual([2, 3, 1])
    expect(ids(sortRows(rows, { key: 'due', dir: 'asc' }))).toEqual([3, 1, 2])
    expect(ids(sortRows(rows, { key: 'done', dir: 'desc' }))).toEqual([3, 1, 2])
    expect(ids(sortRows(rows, { key: 'column', dir: 'desc' }))).toEqual([3, 1, 2])
  })

  test('the same header flips the direction; another starts ascending', () => {
    expect(nextSort({ key: 'title', dir: 'asc' }, 'title')).toEqual({ key: 'title', dir: 'desc' })
    expect(nextSort({ key: 'title', dir: 'desc' }, 'due')).toEqual({ key: 'due', dir: 'asc' })
  })
})
