import { describe, expect, test } from 'vitest'
import type { Board, Card } from '../api/boards'
import {
  dueLabel,
  dueStatus,
  EMPTY_FILTERS,
  filtersActive,
  findCard,
  insertCard,
  insertColumn,
  matchesFilters,
  moveCard,
  progress,
  removeCard,
  removeColumn,
  reorderColumns,
  updateCard,
} from './logic'

const TODAY = new Date(2026, 9, 20)

function card(id: number, extra: Partial<Card> = {}): Card {
  return {
    id,
    title: `Card ${id}`,
    details: '',
    completed: false,
    priority: 'medium',
    due_date: null,
    position: 0,
    label_ids: [],
    checklist: [],
    attachments: [], assignee_ids: [],
    ...extra,
  }
}

function board(): Board {
  return {
    id: 1,
    title: 'B',
    background: { kind: 'none' as const, preset: null, version: 0 }, role: 'admin' as const, public: false, public_link: null, meeting_url: null, members: [],
    labels: [{ id: 9, name: 'Bug', color: 'red' }],
    columns: [
      { id: 1, title: 'To Do', position: 0, cards: [card(1), card(2), card(3)] },
      { id: 2, title: 'Doing', position: 1, cards: [card(4)] },
      { id: 3, title: 'Done', position: 2, cards: [] },
    ],
  }
}

const ids = (b: Board, col: number) => b.columns[col].cards.map((c) => c.id)
const positions = (b: Board, col: number) => b.columns[col].cards.map((c) => c.position)

describe('due date status (T-205)', () => {
  test.each([
    ['2026-10-19', false, 'overdue'],
    ['2026-10-20', false, 'soon'],
    ['2026-10-22', false, 'soon'],
    ['2026-10-23', false, 'later'],
    ['2026-10-01', true, 'none'],
    [null, false, 'none'],
  ] as const)('%s completed=%s is %s', (due, completed, expected) => {
    expect(dueStatus(due, completed, TODAY)).toBe(expected)
  })

  test('labels are friendly', () => {
    expect(dueLabel('2026-10-20', TODAY)).toBe('Today')
    expect(dueLabel('2026-10-21', TODAY)).toBe('Tomorrow')
    expect(dueLabel('2026-10-19', TODAY)).toBe('Yesterday')
    expect(dueLabel('2026-12-05', TODAY)).toMatch(/Dec 5/)
  })
})

describe('filters (T-206)', () => {
  const c = card(1, {
    title: 'Fix checkout',
    details: 'Slow networks',
    priority: 'urgent',
    label_ids: [9],
  })

  test('"Assigned to me" keeps only cards assigned to the user (T-574)', () => {
    const mine = { ...EMPTY_FILTERS, assignee: 7 }
    expect(filtersActive(mine)).toBe(true)
    expect(matchesFilters({ ...c, assignee_ids: [3, 7] }, mine)).toBe(true)
    expect(matchesFilters({ ...c, assignee_ids: [3] }, mine)).toBe(false)
  })

  test('empty filters match everything and are inactive', () => {
    expect(matchesFilters(c, EMPTY_FILTERS)).toBe(true)
    expect(filtersActive(EMPTY_FILTERS)).toBe(false)
  })

  test('text matches title or details, ignoring case', () => {
    expect(matchesFilters(c, { ...EMPTY_FILTERS, text: 'CHECKOUT' })).toBe(true)
    expect(matchesFilters(c, { ...EMPTY_FILTERS, text: 'networks' })).toBe(true)
    expect(matchesFilters(c, { ...EMPTY_FILTERS, text: 'pricing' })).toBe(false)
  })

  test('label, priority and status', () => {
    expect(matchesFilters(c, { ...EMPTY_FILTERS, labelId: 9 })).toBe(true)
    expect(matchesFilters(c, { ...EMPTY_FILTERS, labelId: 8 })).toBe(false)
    expect(matchesFilters(c, { ...EMPTY_FILTERS, priority: 'urgent' })).toBe(true)
    expect(matchesFilters(c, { ...EMPTY_FILTERS, priority: 'low' })).toBe(false)
    expect(matchesFilters(c, { ...EMPTY_FILTERS, status: 'open' })).toBe(true)
    expect(matchesFilters(c, { ...EMPTY_FILTERS, status: 'done' })).toBe(false)
  })

  test('filters combine', () => {
    const f = { ...EMPTY_FILTERS, text: 'fix', priority: 'low' as const }
    expect(filtersActive(f)).toBe(true)
    expect(matchesFilters(c, f)).toBe(false)
  })
})

describe('progress (T-207)', () => {
  test('counts completed cards', () => {
    const b = updateCard(board(), 1, { completed: true })
    expect(progress(b)).toEqual({ done: 1, total: 4, percent: 25 })
  })

  test('empty board is 0%', () => {
    expect(progress({ ...board(), columns: [] })).toEqual({ done: 0, total: 0, percent: 0 })
  })
})

describe('board edits', () => {
  test('move within a column renumbers positions', () => {
    const b = moveCard(board(), 1, 1, 2)
    expect(ids(b, 0)).toEqual([2, 3, 1])
    expect(positions(b, 0)).toEqual([0, 1, 2])
  })

  test('move to another column', () => {
    const b = moveCard(board(), 2, 2, 0)
    expect(ids(b, 0)).toEqual([1, 3])
    expect(ids(b, 1)).toEqual([2, 4])
    expect(positions(b, 0)).toEqual([0, 1])
    expect(positions(b, 1)).toEqual([0, 1])
  })

  test('cards whose place does not change keep their identity, so they are not redrawn', () => {
    const before = board()
    before.columns[0].cards.forEach((c, i) => (c.position = i))
    const after = moveCard(before, 3, 2, 1)
    expect(after.columns[0].cards[0]).toBe(before.columns[0].cards[0])
    expect(after.columns[0].cards[1]).toBe(before.columns[0].cards[1])
    expect(after.columns[1].cards[0]).toBe(before.columns[1].cards[0])
    expect(after.labels).toBe(before.labels)
  })

  test('move past the end goes last', () => {
    expect(ids(moveCard(board(), 1, 3, 99), 2)).toEqual([1])
  })

  test('remove and re-insert a card at its old place', () => {
    const original = board()
    const removed = removeCard(original, 2)
    expect(ids(removed, 0)).toEqual([1, 3])
    const restored = insertCard(removed, 1, 1, original.columns[0].cards[1])
    expect(ids(restored, 0)).toEqual([1, 2, 3])
    expect(positions(restored, 0)).toEqual([0, 1, 2])
  })

  test('reorder, remove and re-insert columns', () => {
    const b = reorderColumns(board(), [3, 1, 2])
    expect(b.columns.map((c) => c.id)).toEqual([3, 1, 2])
    expect(b.columns.map((c) => c.position)).toEqual([0, 1, 2])
    const original = board()
    const restored = insertColumn(removeColumn(original, 2), 1, original.columns[1])
    expect(restored.columns.map((c) => c.id)).toEqual([1, 2, 3])
  })

  test('edits do not mutate the original board', () => {
    const original = board()
    moveCard(original, 1, 2, 0)
    updateCard(original, 1, { title: 'changed' })
    expect(ids(original, 0)).toEqual([1, 2, 3])
    expect(original.columns[0].cards[0].title).toBe('Card 1')
  })
})

describe('auto-complete (T-687)', () => {
  const done = (b: Board, id: number) => findCard(b, id)!.card.completed

  test('the last column completes a card and leaving it reopens the card', () => {
    const b = { ...board(), auto_complete: true }
    const moved = moveCard(b, 1, 3, 0)
    expect(done(moved, 1)).toBe(true)
    expect(done(moveCard(moved, 1, 2, 0), 1)).toBe(false)
    expect(done(moveCard(b, 1, 2, 0), 1)).toBe(false)
  })

  test('off: moves keep the card as it was', () => {
    expect(done(moveCard(board(), 1, 3, 0), 1)).toBe(false)
  })
})

describe('overdue filter (T-785)', () => {
  test('keeps only open cards whose due date has passed', () => {
    const late = card(1, { due_date: '2020-01-01' })
    const lateDone = card(2, { due_date: '2020-01-01', completed: true })
    const later = card(3, { due_date: '2999-01-01' })
    const f = { ...EMPTY_FILTERS, status: 'overdue' as const }
    expect([late, lateDone, later].filter((c) => matchesFilters(c, f)).map((c) => c.id)).toEqual([1])
  })
})
