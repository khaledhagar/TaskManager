import type { Board, Card, Column } from '../api/boards'
import { PRIORITIES } from './display'
import { matchesFilters, type Filters } from './logic'

export type SortKey = 'title' | 'column' | 'priority' | 'due' | 'done'
export type Sort = { key: SortKey; dir: 'asc' | 'desc' }
export type Row = { card: Card; column: Column; columnIndex: number }

/** Every card that passes the filters, in board order. */
export function listRows(board: Board, filters: Filters): Row[] {
  return board.columns.flatMap((column, columnIndex) =>
    column.cards.filter((card) => matchesFilters(card, filters)).map((card) => ({ card, column, columnIndex })),
  )
}

const VALUE: Record<SortKey, (r: Row) => string | number> = {
  title: (r) => r.card.title.toLocaleLowerCase(),
  column: (r) => r.columnIndex,
  // Urgent first when ascending.
  priority: (r) => PRIORITIES.indexOf(r.card.priority),
  // Cards without a due date go last.
  due: (r) => r.card.due_date ?? '9999-12-31',
  done: (r) => Number(r.card.completed),
}

/** Sorted copy; ties keep board order. */
export function sortRows(rows: Row[], { key, dir }: Sort): Row[] {
  const sign = dir === 'asc' ? 1 : -1
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => {
      const x = VALUE[key](a.row)
      const y = VALUE[key](b.row)
      return x < y ? -sign : x > y ? sign : a.i - b.i
    })
    .map(({ row }) => row)
}

/** Clicking the sorted column flips its direction; another column starts ascending. */
export const nextSort = (current: Sort, key: SortKey): Sort =>
  current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
