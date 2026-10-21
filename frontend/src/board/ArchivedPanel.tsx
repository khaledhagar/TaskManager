import { useCallback, useEffect, useState } from 'react'
import { boards, type ArchivedCard } from '../api/boards'
import { useI18n } from '../i18n/context'
import { Dialog } from '../ui/Dialog'
import { useToast } from '../ui/toastContext'
import ui from '../ui/ui.module.css'
import css from './organize.module.css'
import type { BoardActions } from './useBoard'

type Props = { open: boolean; onClose: () => void; boardId: number; actions: BoardActions }

/** Board menu "Archived cards": restore a card to its column or delete it for good. */
export function ArchivedPanel({ open, onClose, boardId, actions }: Props) {
  const { t } = useI18n()
  return (
    <Dialog open={open} onClose={onClose} title={t('archive.title')}>
      {open ? <ArchivedList boardId={boardId} actions={actions} /> : null}
    </Dialog>
  )
}

function ArchivedList({ boardId, actions }: Omit<Props, 'open' | 'onClose'>) {
  const { t } = useI18n()
  const toast = useToast()
  const [cards, setCards] = useState<ArchivedCard[] | null>(null)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(
    () => boards.archived(boardId).then(setCards, (e: Error) => setError(e.message)),
    [boardId],
  )

  useEffect(() => {
    load()
  }, [load])

  async function restore(id: number) {
    if (await actions.restoreCard(id)) {
      toast({ message: t('archive.restored') })
      load()
    }
  }

  async function remove(id: number) {
    setConfirmId(null)
    if (!actions.allowed('editor')) return
    await boards.removeCard(id).catch((e: Error) => setError(e.message))
    load()
  }

  if (error)
    return (
      <p className={ui.alert} role="alert">
        {error}
      </p>
    )
  if (!cards) return null
  if (cards.length === 0) return <p className={ui.hint}>{t('archive.empty')}</p>
  return (
    <ul className={css.list}>
      {cards.map((c) => (
        <li key={c.id} className={css.row}>
          <span className={css.rowText}>
            <span dir="auto">{c.title}</span>
            <span className={ui.hint} dir="auto">
              {t('archive.from', { column: c.column_title })}
            </span>
          </span>
          {confirmId === c.id ? (
            <span className={css.rowActions}>
              <button type="button" className={`${ui.button} ${ui.danger}`} onClick={() => remove(c.id)}>
                {t('archive.deleteForever')}
              </button>
              <button type="button" className={`${ui.button} ${ui.ghost}`} onClick={() => setConfirmId(null)}>
                {t('ui.keep')}
              </button>
            </span>
          ) : (
            <span className={css.rowActions}>
              <button
                type="button"
                className={`${ui.button} ${ui.secondary}`}
                aria-label={t('archive.restoreCard', { title: c.title })}
                onClick={() => restore(c.id)}
              >
                {t('archive.restore')}
              </button>
              <button
                type="button"
                className={`${ui.button} ${ui.ghost}`}
                aria-label={t('archive.deleteCard', { title: c.title })}
                onClick={() => setConfirmId(c.id)}
              >
                {t('archive.delete')}
              </button>
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
