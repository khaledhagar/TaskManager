import { ar } from './ar'
import { en } from './en'
import type { Dictionary, Key, Language, Params } from './messages'

const DICTIONARIES: Record<Language, Dictionary> = { en, ar }

/** Locale for `Intl`: Arabic keeps Western digits (0-9). */
export function locale(lang: Language): string {
  return lang === 'ar' ? 'ar-u-nu-latn' : 'en'
}

/** The message for `key` in `lang`, with `{name}` placeholders filled and plurals picked by `count`. */
export function translate(lang: Language, key: Key, params: Params = {}): string {
  const message = DICTIONARIES[lang][key]
  const text =
    typeof message === 'string'
      ? message
      : (message[new Intl.PluralRules(lang).select(Number(params.count ?? 0))] ?? message.other)
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? formatValue(lang, params[name]) : match,
  )
}

function formatValue(lang: Language, value: string | number): string {
  return typeof value === 'number' ? formatNumber(lang, value) : value
}

export function formatNumber(lang: Language, value: number): string {
  return new Intl.NumberFormat(locale(lang)).format(value)
}

export function formatDate(lang: Language, date: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale(lang), options).format(date)
}
