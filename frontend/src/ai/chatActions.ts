import type { ChatAction } from '../api/ai'
import type { Board } from '../api/boards'
import { findCard } from '../board/logic'
import type { BoardActions } from '../board/useBoard'
import { t } from '../i18n/language'

/** A sentence for the user describing `action`, or null when it no longer fits the board. */
export function describeAction(action: ChatAction, board: Board): string | null {
  const column = board.columns.find((c) => c.id === action.column_id)
  const card = action.card_id === null ? undefined : findCard(board, action.card_id)?.card
  if (action.type === 'create_card' && column && action.title)
    return t('chat.createCard', { title: action.title, column: column.title })
  if (action.type === 'move_card' && card && column)
    return t('chat.moveCard', { title: card.title, column: column.title })
  if (action.type === 'complete_card' && card) return t('chat.completeCard', { title: card.title })
  return null
}

/** Carry out a confirmed action with the normal board actions (optimistic, rolled back on error). */
export function applyAction(action: ChatAction, board: Board, actions: BoardActions) {
  if (action.type === 'create_card') return actions.addCard(action.column_id!, action.title!)
  if (action.type === 'complete_card') return actions.updateCard(action.card_id!, { completed: true })
  const target = board.columns.find((c) => c.id === action.column_id)!
  const from = findCard(board, action.card_id!)!.column
  const end = from.id === target.id ? target.cards.length - 1 : target.cards.length
  return actions.moveCard(action.card_id!, target.id, end)
}
