import { translate } from './core'
import { LANGUAGES, type Key, type Language, type Params } from './messages'

const KEY = 'language'
let current: Language = 'en'

function saved(): Language | null {
  try {
    const value = localStorage.getItem(KEY)
    return LANGUAGES.includes(value as Language) ? (value as Language) : null
  } catch {
    return null
  }
}

/** True when this browser has a saved choice (it then wins over the account setting). */
export function hasSavedLanguage(): boolean {
  return saved() !== null
}

/** The saved language, or the browser language when nothing is saved. */
export function initialLanguage(): Language {
  return saved() ?? (navigator.language.toLowerCase().startsWith('ar') ? 'ar' : 'en')
}

/** Make `lang` current: page `lang`/`dir`, `Accept-Language` and `t()`. */
export function applyLanguage(lang: Language) {
  current = lang
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  document.title = translate(lang, 'app.title')
}

export function saveLanguage(lang: Language) {
  try {
    localStorage.setItem(KEY, lang)
  } catch {
    // Storage can be blocked; the language still applies for this visit.
  }
}

export function currentLanguage(): Language {
  return current
}

/** Translate in the current language; for code outside React components. */
export function t(key: Key, params?: Params): string {
  return translate(current, key, params)
}
