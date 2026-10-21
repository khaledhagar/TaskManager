import { Bell } from 'lucide-react'
import { useEffect, useState } from 'react'
import { notifications, type Notice } from '../api/notifications'
import { timeAgo } from '../collab/activityText'
import { useI18n } from '../i18n/context'
import { navigate } from '../lib/router'
import { byUnreadFirst, noticeLink, noticeText, OPEN_BELL } from '../shell/notices'
import ui from '../ui/ui.module.css'
import css from './start.module.css'

const SHOWN = 5

/** Start page: the latest notifications (invitations, changes to your cards), unread first. */
export function WhatsNew() {
  const { t } = useI18n()
  const [items, setItems] = useState<Notice[] | null>(null)

  useEffect(() => {
    notifications.list().then((d) => setItems(byUnreadFirst(d.items).slice(0, SHOWN)), () => setItems([]))
  }, [])

  async function open(n: Notice) {
    if (!n.read) await notifications.read(n.id)
    navigate(noticeLink(n))
  }

  if (!items) return null
  return (
    <section className={css.news} aria-labelledby="whats-new">
      <div className={css.newsHead}>
        <h2 id="whats-new" className={css.groupTitle}>
          <Bell size={16} aria-hidden="true" /> {t('start.whatsNew')}
        </h2>
        {items.length ? (
          <button type="button" className={ui.linkButton} onClick={() => window.dispatchEvent(new Event(OPEN_BELL))}>
            {t('start.seeAll')}
          </button>
        ) : null}
      </div>
      {items.length ? (
        <ul className={css.newsList}>
          {items.map((n) => (
            <li key={n.id}>
              <button type="button" className={css.newsItem} data-unread={!n.read || undefined} onClick={() => open(n)}>
                {n.read ? null : <span className="visually-hidden">{t('notify.unread')}: </span>}
                <span dir="auto">{noticeText(n)}</span>
                <time className={ui.hint} dateTime={n.created_at}>
                  {timeAgo(n.created_at)}
                </time>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={ui.hint}>{t('start.nothingNew')}</p>
      )}
    </section>
  )
}
