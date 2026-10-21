import type { Priority } from '../api/boards'

/** Day names by `Date.getDay()` (Sunday first), in English and in folded Arabic. */
const DAYS = [
  ['sunday', 'الاحد'],
  ['monday', 'الاثنين'],
  ['tuesday', 'الثلاثاء'],
  ['wednesday', 'الاربعاء'],
  ['thursday', 'الخميس'],
  ['friday', 'الجمعه'],
  ['saturday', 'السبت'],
]

/** Every due-date word the commands accept (folded), for building the patterns. */
export const DUE_WORDS = [
  'today', 'tomorrow', 'next week', 'اليوم', 'غدا', 'بكره', 'الاسبوع القادم', 'الاسبوع المقبل',
  ...DAYS.flat(),
]

const PRIORITIES: Record<string, Priority> = {
  low: 'low', منخفضه: 'low', قليله: 'low',
  medium: 'medium', normal: 'medium', متوسطه: 'medium', عاديه: 'medium',
  high: 'high', عاليه: 'high', مرتفعه: 'high',
  urgent: 'urgent', عاجله: 'urgent',
}
export const PRIORITY_WORDS = Object.keys(PRIORITIES)
export const priorityFrom = (word: string) => PRIORITIES[word]

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** The date a due word means; a weekday is the next one after today (a week ahead if today). */
export function dueFrom(word: string, today: Date): string {
  const plus = (days: number) => iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + days))
  if (word === 'today' || word === 'اليوم') return plus(0)
  if (word === 'tomorrow' || word === 'غدا' || word === 'بكره') return plus(1)
  const day = DAYS.findIndex((names) => names.includes(word))
  if (day >= 0) return plus((day - today.getDay() + 7) % 7 || 7)
  return plus(7)
}
