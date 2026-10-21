import type { Notice } from '../api/notifications'
import { en } from '../i18n/en'
import { t } from '../i18n/language'
import type { Key } from '../i18n/messages'

/** A notification as a sentence in the current language. Card changes name the change. */
export function noticeText(n: Notice): string {
  const params = { actor: n.actor_email ?? t('activity.someone'), title: n.data.title ?? '', board: n.data.board ?? '' }
  const change = `notify.change.${n.data.change}`
  if (n.kind === 'card_changed' && change in en) return t(change as Key, params)
  return t(`notify.${n.kind}`, params)
}

/** Where a notification leads: the invitation, the card, or the board. */
export function noticeLink(n: Notice): string {
  if (n.kind === 'invited' && n.data.path) return n.data.path
  return n.card_id ? `/?board=${n.board_id}&card=${n.card_id}` : `/?board=${n.board_id}`
}

/** Unread first, newest first within each. */
export const byUnreadFirst = (items: Notice[]) => [...items].sort((a, b) => Number(a.read) - Number(b.read) || b.id - a.id)

/** Ask the header bell to open its list (used by What's new on the start page). */
export const OPEN_BELL = 'open-notifications'
