import { boards, type Board, type BoardSummary } from '../api/boards'
import { t } from '../i18n/language'
import type { MenuItem } from '../ui/Menu'
import type { Show } from '../ui/toastContext'
import ui from '../ui/ui.module.css'
import css from './organize.module.css'
import type { BoardActions } from './useBoard'

type Options = {
  board: Board
  actions: BoardActions
  starred: boolean
  toast: Show
  onUpdated: (id: number, changes: Partial<BoardSummary>) => void
  onCreated: (board: BoardSummary) => void
  openArchived: () => void
  openTemplate: () => void
}

/** Board menu items, star, archived note and focus sessions (Phase 24). */
export function boardOrganize({ board, actions, starred, toast, onUpdated, onCreated, openArchived, openTemplate }: Options) {
  const admin = board.role === 'admin'
  const failed = (e: Error) => toast({ message: e.message, tone: 'error' })

  function duplicate() {
    if (!actions.allowed('editor')) return
    boards.duplicate(board.id).then((copy) => {
      toast({ message: t('board.duplicated') })
      onCreated(copy)
    }, failed)
  }

  function setArchived(archived: boolean) {
    if (!actions.allowed('admin')) return
    const request = archived ? boards.archive : boards.restore
    request(board.id).then(() => {
      actions.setBoardInfo({ archived })
      onUpdated(board.id, { archived })
    }, failed)
  }

  async function toggleAutoComplete() {
    const on = !board.auto_complete
    const saving = actions.setAutoComplete(on)
    if (saving === false) return
    await saving
    toast({ message: t(on ? 'board.autoCompleteOnToast' : 'board.autoCompleteOffToast') })
  }

  const menuItems: MenuItem[] = [
    { kind: 'action', label: t('board.archivedCards'), onSelect: openArchived },
    { kind: 'action', label: t('board.duplicate'), onSelect: duplicate },
    { kind: 'action', label: t('board.saveTemplate'), onSelect: () => actions.allowed('editor') && openTemplate() },
    ...(admin
      ? [
          {
            kind: 'action' as const,
            label: t(board.auto_complete ? 'board.autoCompleteOn' : 'board.autoCompleteOff'),
            onSelect: toggleAutoComplete,
          },
          {
            kind: 'action' as const,
            label: t(board.archived ? 'board.restore' : 'board.archive'),
            onSelect: () => setArchived(!board.archived),
          },
        ]
      : []),
  ]

  return {
    menuItems,
    star: () => boards.star(board.id, !starred).then(() => onUpdated(board.id, { starred: !starred }), failed),
    onFocusDone: (cardId: number, minutes: number) =>
      boards.addFocus(cardId, minutes).then((stats) => {
        actions.focusAdded(cardId, stats)
        const title = board.columns.flatMap((c) => c.cards).find((c) => c.id === cardId)?.title ?? ''
        toast({ message: t('timer.saved', { title }) })
      }, failed),
    note: board.archived ? (
      <p className={css.note}>
        {t('board.archivedNote')}
        {admin ? (
          <button type="button" className={ui.linkButton} onClick={() => setArchived(false)}>
            {t('board.restore')}
          </button>
        ) : null}
      </p>
    ) : null,
  }
}
