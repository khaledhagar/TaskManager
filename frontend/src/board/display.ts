import type { LabelColor, Priority } from '../api/boards'
import { t } from '../i18n/language'

export const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low']

export const priorityLabel = (priority: Priority) => t(`priority.${priority}`)

/** Swatch colors for label dots (never used for text). */
export const LABEL_SWATCH: Record<LabelColor, string> = {
  red: '#d64545',
  orange: '#e07b28',
  yellow: '#ecad0a',
  green: '#2f9e6a',
  blue: '#209dd7',
  purple: '#753991',
  gray: '#888888',
}

export const LABEL_COLORS = Object.keys(LABEL_SWATCH) as LabelColor[]
