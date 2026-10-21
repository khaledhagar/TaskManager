import type { Board } from '../api/boards'
import { priorityLabel } from '../board/display'
import { dueLabel } from '../board/logic'
import { t } from '../i18n/language'
import type { Change } from './commands'

/** The sentence shown before Confirm, e.g. 'Add card "Buy domain" to To Do'. */
export function describeChange(change: Change, board: Board, me: number): string {
  const cardTitle = (id: number) => board.columns.flatMap((c) => c.cards).find((c) => c.id === id)?.title ?? ''
  const columnTitle = (id: number) => board.columns.find((c) => c.id === id)?.title ?? ''
  switch (change.type) {
    case 'add':
      return t('vc.add', { title: change.title, column: columnTitle(change.columnId) })
    case 'move':
      return t('vc.move', { card: cardTitle(change.cardId), column: columnTitle(change.columnId) })
    case 'complete':
      return t(change.done ? 'vc.complete' : 'vc.reopen', { card: cardTitle(change.cardId) })
    case 'delete':
      return t('vc.delete', { card: cardTitle(change.cardId) })
    case 'rename':
      return t('vc.rename', { card: cardTitle(change.cardId), title: change.title })
    case 'priority':
      return t('vc.priority', { card: cardTitle(change.cardId), priority: priorityLabel(change.priority) })
    case 'due':
      return t('vc.due', { card: cardTitle(change.cardId), date: dueLabel(change.date) })
    case 'assign': {
      const person = change.userId === me ? t('vc.me') : (board.members.find((m) => m.user_id === change.userId)?.email ?? '')
      return t('vc.assign', { card: cardTitle(change.cardId), person })
    }
    case 'addColumn':
      return t('vc.addColumn', { title: change.title })
  }
}
