/** Pure board helpers: due dates, filters, progress, and immutable board edits. */
import type { Board, Card, Column, Priority } from '../api/boards'
import { formatDate } from '../i18n/core'
import { currentLanguage, t } from '../i18n/language'

export type DueStatus = 'none' | 'overdue' | 'soon' | 'later'
export type Filters = {
  text: string
  labelId: number | null
  priority: Priority | null
  status: 'all' | 'open' | 'done' | 'overdue'
  /** The signed-in user's id when "Assigned to me" is chosen. */
  assignee: number | null
}

/** Drag-and-drop ids for cards and columns. */
export const cardKey = (id: number) => `card-${id}`
export const columnKey = (id: number) => `column-${id}`

export const EMPTY_FILTERS: Filters = { text: '', labelId: null, priority: null, status: 'all', assignee: null }
const SOON_DAYS = 2
const DAY = 86_400_000

function daysFrom(today: Date, isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / DAY)
}

export function dueStatus(due: string | null, completed: boolean, today = new Date()): DueStatus {
  if (!due || completed) return 'none'
  const days = daysFrom(today, due)
  if (days < 0) return 'overdue'
  return days <= SOON_DAYS ? 'soon' : 'later'
}

export function dueLabel(due: string, today = new Date()): string {
  const days = daysFrom(today, due)
  if (days === 0) return t('due.today')
  if (days === 1) return t('due.tomorrow')
  if (days === -1) return t('due.yesterday')
  const [y, m, d] = due.split('-').map(Number)
  const sameYear = y === today.getFullYear()
  return formatDate(currentLanguage(), new Date(y, m - 1, d), {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  })
}

export function filtersActive(f: Filters): boolean {
  return f.text.trim() !== '' || f.labelId !== null || f.priority !== null || f.status !== 'all' || f.assignee !== null
}

export function matchesFilters(card: Card, f: Filters): boolean {
  const text = f.text.trim().toLowerCase()
  if (text && !`${card.title}\n${card.details}`.toLowerCase().includes(text)) return false
  if (f.labelId !== null && !card.label_ids.includes(f.labelId)) return false
  if (f.priority !== null && card.priority !== f.priority) return false
  if (f.status === 'open' && card.completed) return false
  if (f.status === 'done' && !card.completed) return false
  if (f.status === 'overdue' && dueStatus(card.due_date, card.completed) !== 'overdue') return false
  if (f.assignee !== null && !card.assignee_ids.includes(f.assignee)) return false
  return true
}

export function progress(board: Board) {
  const cards = board.columns.flatMap((c) => c.cards)
  const done = cards.filter((c) => c.completed).length
  return { done, total: cards.length, percent: cards.length ? Math.round((done / cards.length) * 100) : 0 }
}

/** Number items 0, 1, 2...; an item already in place is kept as is, so it is not redrawn. */
const renumber = <T extends { position: number }>(items: T[]): T[] =>
  items.map((item, position) => (item.position === position ? item : { ...item, position }))

function mapColumns(board: Board, fn: (column: Column) => Column): Board {
  return { ...board, columns: board.columns.map(fn) }
}

export function findCard(board: Board, cardId: number) {
  for (const column of board.columns) {
    const index = column.cards.findIndex((c) => c.id === cardId)
    if (index >= 0) return { column, index, card: column.cards[index] }
  }
  return null
}

export function updateCard(board: Board, cardId: number, changes: Partial<Card>): Board {
  return mapColumns(board, (col) => ({
    ...col,
    cards: col.cards.map((c) => (c.id === cardId ? { ...c, ...changes } : c)),
  }))
}

export function removeCard(board: Board, cardId: number): Board {
  return mapColumns(board, (col) =>
    col.cards.some((c) => c.id === cardId)
      ? { ...col, cards: renumber(col.cards.filter((c) => c.id !== cardId)) }
      : col,
  )
}

export function insertCard(board: Board, columnId: number, index: number, card: Card): Board {
  return mapColumns(board, (col) => {
    if (col.id !== columnId) return col
    const cards = [...col.cards]
    cards.splice(Math.min(index, cards.length), 0, card)
    return { ...col, cards: renumber(cards) }
  })
}

export function moveCard(board: Board, cardId: number, columnId: number, index: number): Board {
  const found = findCard(board, cardId)
  if (!found) return board
  const completed = autoCompleted(board, found.column.id, columnId, found.card.completed)
  return insertCard(removeCard(board, cardId), columnId, index, { ...found.card, completed })
}

/** With auto-complete on, the last column means done; leaving it reopens the card. */
export function autoCompleted(board: Board, from: number, to: number, completed: boolean): boolean {
  if (!board.auto_complete || from === to) return completed
  const last = board.columns.at(-1)?.id
  return to === last ? true : from === last ? false : completed
}

export function reorderColumns(board: Board, columnIds: number[]): Board {
  const byId = new Map(board.columns.map((c) => [c.id, c]))
  return { ...board, columns: renumber(columnIds.map((id) => byId.get(id)!)) }
}

export function removeColumn(board: Board, columnId: number): Board {
  return { ...board, columns: renumber(board.columns.filter((c) => c.id !== columnId)) }
}

export function insertColumn(board: Board, index: number, column: Column): Board {
  const columns = [...board.columns]
  columns.splice(Math.min(index, columns.length), 0, column)
  return { ...board, columns: renumber(columns) }
}
