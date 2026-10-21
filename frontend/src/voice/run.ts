import type { Board } from '../api/boards'
import { EMPTY_FILTERS, findCard, type Filters } from '../board/logic'
import type { BoardActions } from '../board/useBoard'
import type { Change, Lookup } from './commands'

/** Carry out a confirmed change through the board's own actions (same permission checks, Undo). */
export function runChange(change: Change, board: Board, actions: BoardActions) {
  switch (change.type) {
    case 'add':
      return actions.addCard(change.columnId, change.title)
    case 'move': {
      const column = board.columns.find((c) => c.id === change.columnId)
      return actions.moveCard(change.cardId, change.columnId, column?.cards.length ?? 0)
    }
    case 'complete':
      return actions.updateCard(change.cardId, { completed: change.done })
    case 'delete':
      return actions.deleteCard(change.cardId)
    case 'rename':
      return actions.updateCard(change.cardId, { title: change.title })
    case 'priority':
      return actions.updateCard(change.cardId, { priority: change.priority })
    case 'due':
      return actions.updateCard(change.cardId, { due_date: change.date })
    case 'assign': {
      const current = findCard(board, change.cardId)?.card.assignee_ids ?? []
      return actions.setAssignees(change.cardId, [...new Set([...current, change.userId])])
    }
    case 'addColumn':
      return actions.addColumn(change.title)
  }
}

type Screen = {
  filters: Filters
  setFilters: (filters: Filters) => void
  openCard: (id: number) => void
  go: (path: string) => void
}

/** Carry out a look-up at once: open, search, filter, or go to a board or the start page. */
export function runLookup(lookup: Lookup, screen: Screen) {
  switch (lookup.type) {
    case 'openCard':
      return screen.openCard(lookup.cardId)
    case 'openBoard':
      return screen.go(`/?board=${lookup.boardId}`)
    case 'home':
      return screen.go('/')
    case 'search':
      return screen.setFilters({ ...screen.filters, text: lookup.text })
    case 'filter':
      return screen.setFilters({ ...screen.filters, ...lookup.filters })
    case 'clearFilters':
      return screen.setFilters(EMPTY_FILTERS)
    case 'help':
      return undefined
  }
}
