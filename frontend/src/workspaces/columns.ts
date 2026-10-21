import { t } from '../i18n/language'

export const MAX_COLUMNS = 20

/** To Do, In Progress, Done in the current language. */
export const defaultColumns = () => [t('columns.todo'), t('columns.doing'), t('columns.done')]

/** Names to send: trimmed, empty ones dropped; the defaults when nothing is left. */
export function cleanColumns(columns: string[]): string[] {
  const names = columns.map((c) => c.trim()).filter(Boolean)
  return names.length ? names : defaultColumns()
}
