import { createContext, Fragment, useContext, type ReactNode } from 'react'
import { formatDate, formatNumber, translate } from './core'
import type { Key, Language, Params } from './messages'

/** Everything components need for one language. */
export function bind(lang: Language, setLanguage: (lang: Language) => void) {
  return {
    lang,
    setLanguage,
    t: (key: Key, params?: Params) => translate(lang, key, params),
    /** Translate, putting React nodes (links, bold text) where `{name}` placeholders are. */
    rich: (key: Key, nodes: Record<string, ReactNode>) =>
      translate(lang, key)
        .split(/\{(\w+)\}/)
        .map((part, i) => (i % 2 ? <Fragment key={i}>{nodes[part]}</Fragment> : part)),
    date: (date: Date, options: Intl.DateTimeFormatOptions) => formatDate(lang, date, options),
    number: (value: number) => formatNumber(lang, value),
  }
}

export const I18nContext = createContext(bind('en', () => {}))

/** `t()`, date and number formatting in the current language, plus the switch. */
export function useI18n() {
  return useContext(I18nContext)
}
