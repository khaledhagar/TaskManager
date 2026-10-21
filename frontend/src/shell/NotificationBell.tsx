import { Bell } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { notifications, type Notice } from '../api/notifications'
import { timeAgo } from '../collab/activityText'
import { useI18n } from '../i18n/context'
import { navigate } from '../lib/router'
import { Dialog } from '../ui/Dialog'
import ui from '../ui/ui.module.css'
import css from './bell.module.css'

/**
 * Header bell with the unread count. The count refreshes when the app loads, when the tab
 * regains focus and when the list opens (no timed polling, to save server calls).
 */
export function NotificationBell() {
  const { t } = useI18n()
  const [data, setData] = useState<{ unread: number; items: Notice[] }>({ unread: 0, items: [] })
  const [open, setOpen] = useState(false)

  const load = useCallback(() => notifications.list().then(setData, () => {}), [])
  useEffect(() => {
    load()
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
  }, [load])

  function text(n: Notice): string {
    const params = { actor: n.actor_email ?? t('activity.someone'), title: n.data.title ?? '', board: n.data.board ?? '' }
    return t(`notify.${n.kind}`, params)
  }

  async function openNotice(n: Notice) {
    if (!n.read) await notifications.read(n.id)
    setOpen(false)
    navigate(n.card_id ? `/?board=${n.board_id}&card=${n.card_id}` : `/?board=${n.board_id}`)
    load()
  }

  return (
    <>
      <button
        type="button"
        className={`${ui.iconButton} ${css.bell}`}
        aria-label={t('notify.open', { count: data.unread })}
        title={t('notify.title')}
        onClick={() => {
          setOpen(true)
          load()
        }}
      >
        <Bell size={18} aria-hidden="true" />
        {data.unread ? (
          <span className={css.badge} aria-hidden="true">
            {data.unread > 9 ? '9+' : data.unread}
          </span>
        ) : null}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t('notify.title')}>
        {data.items.length === 0 ? (
          <p className={ui.hint}>{t('notify.empty')}</p>
        ) : (
          <>
            {data.unread ? (
              <button type="button" className={ui.linkButton} onClick={() => notifications.readAll().then(load)}>
                {t('notify.readAll')}
              </button>
            ) : null}
            <ul className={css.list}>
              {data.items.map((n) => (
                <li key={n.id}>
                  <button type="button" className={css.item} data-unread={!n.read || undefined} onClick={() => openNotice(n)}>
                    {n.read ? null : <span className="visually-hidden">{t('notify.unread')}: </span>}
                    <span dir="auto">{text(n)}</span>
                    <time className={ui.hint} dateTime={n.created_at}>
                      {timeAgo(n.created_at)}
                    </time>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Dialog>
    </>
  )
}
