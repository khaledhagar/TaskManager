import type { ActivityEntry } from '../api/collab'
import { locale } from '../i18n/core'
import { en } from '../i18n/en'
import { currentLanguage, t } from '../i18n/language'
import type { Key } from '../i18n/messages'

const ROLES = ['viewer', 'updater', 'editor', 'admin'] as const

/** One activity entry as a sentence in the current language ("You moved "X" to Done"). */
export function activityText(entry: ActivityEntry, myEmail: string | null): string {
  const actor =
    entry.actor_email === null
      ? t('activity.someone')
      : entry.actor_email === myEmail
        ? t('activity.you')
        : entry.actor_email
  const key = `activity.${entry.kind}`
  const params: Record<string, string> = { actor }
  for (const [name, value] of Object.entries(entry.data)) params[name] = Array.isArray(value) ? value.join(', ') : String(value)
  const role = ROLES.find((r) => r === entry.data.role)
  if (role) params.role = t(`role.${role}`)
  return t(key in en ? (key as Key) : 'activity.unknown', params)
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
]

/** "5 minutes ago", "yesterday" in the current language. */
export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000)
  const format = new Intl.RelativeTimeFormat(locale(currentLanguage()), { numeric: 'auto' })
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit)
  }
  return format.format(0, 'minute')
}
