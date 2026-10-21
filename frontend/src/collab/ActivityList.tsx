import { useEffect, useState } from 'react'
import { collab, type ActivityEntry } from '../api/collab'
import { useI18n } from '../i18n/context'
import { Dialog } from '../ui/Dialog'
import ui from '../ui/ui.module.css'
import { activityText, timeAgo } from './activityText'
import css from './collab.module.css'

type Props = { boardId: number; cardId?: number; myEmail: string | null; pageSize?: number; reload?: unknown }

/** Newest changes first, with "Show more" for older ones. For one card or the whole board. */
export function ActivityList({ boardId, cardId, myEmail, pageSize = 20, reload }: Props) {
  const { t } = useI18n()
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null)
  const [more, setMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    collab.activity(boardId, { cardId, limit: pageSize }).then(
      (page) => {
        setEntries(page)
        setMore(page.length === pageSize)
      },
      (e) => setError(e.message),
    )
  }, [boardId, cardId, pageSize, reload])

  async function older() {
    const page = await collab.activity(boardId, { cardId, limit: pageSize, before: entries!.at(-1)!.id })
    setEntries([...entries!, ...page])
    setMore(page.length === pageSize)
  }

  if (error)
    return (
      <p className={ui.alert} role="alert">
        {error}
      </p>
    )
  if (!entries) return null
  if (entries.length === 0) return <p className={ui.hint}>{t(cardId ? 'history.empty' : 'activity.empty')}</p>
  return (
    <>
      <ol className={css.activity}>
        {entries.map((e) => (
          <li key={e.id} className={css.entry}>
            <span dir="auto">{activityText(e, myEmail)}</span>
            <time className={ui.hint} dateTime={e.created_at}>
              {timeAgo(e.created_at)}
            </time>
          </li>
        ))}
      </ol>
      {more ? (
        <button type="button" className={ui.linkButton} onClick={older}>
          {t('history.more')}
        </button>
      ) : null}
    </>
  )
}

/** Board menu "Activity": recent changes by every member. */
export function ActivityPanel({ open, onClose, boardId, myEmail }: { open: boolean; onClose: () => void; boardId: number; myEmail: string | null }) {
  const { t } = useI18n()
  return (
    <Dialog open={open} onClose={onClose} title={t('activity.title')}>
      {open ? <ActivityList boardId={boardId} myEmail={myEmail} pageSize={30} /> : null}
    </Dialog>
  )
}
