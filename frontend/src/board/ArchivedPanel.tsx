import { useCallback, useEffect, useState } from 'react'
import { boards, type ArchivedCard, type ArchivedColumn } from '../api/boards'
import { useI18n } from '../i18n/context'
import { Dialog } from '../ui/Dialog'
import { useToast } from '../ui/toastContext'
import ui from '../ui/ui.module.css'
import css from './organize.module.css'
import type { BoardActions } from './useBoard'

type Props = { open: boolean; onClose: () => void; boardId: number; actions: BoardActions }

/** Board menu "Archived cards and columns": restore them, or delete a card for good. */
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
  const [columns, setColumns] = useState<ArchivedColumn[]>([])
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(
    () =>
      Promise.all([boards.archived(boardId), boards.archivedColumns(boardId)]).then(([c, cols]) => {
        setCards(c)
        setColumns(cols)
      }, (e: Error) => setError(e.message)),
    [boardId],
  )

  async function restoreColumn(id: number) {
    if (await actions.restoreColumn(id)) {
      toast({ message: t('archive.columnRestored') })
      load()
    }
  }

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
  if (cards.length === 0 && columns.length === 0) return <p className={ui.hint}>{t('archive.empty')}</p>
  return (
    <>
    {columns.length ? (
      <section className={css.archiveGroup}>
        <h3 className={css.archiveHeading}>{t('archive.columns')}</h3>
        <ul className={css.list}>
          {columns.map((c) => (
            <li key={c.id} className={css.row}>
              <span className={css.rowText}>
                <span dir="auto">{c.title}</span>
                <span className={ui.hint}>{t('column.cardCount', { count: c.cards })}</span>
              </span>
              <button
                type="button"
                className={`${ui.button} ${ui.secondary}`}
                aria-label={t('archive.restoreColumn', { title: c.title })}
                onClick={() => restoreColumn(c.id)}
              >
                {t('archive.restore')}
              </button>
            </li>
          ))}
        </ul>
      </section>
    ) : null}
    {cards.length ? <h3 className={css.archiveHeading}>{t('archive.cards')}</h3> : null}
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
    </>
  )
}
