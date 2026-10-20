import type { en } from './en'

export type Language = 'en' | 'ar'
export const LANGUAGES: Language[] = ['en', 'ar']

/** A message that changes with `{count}`; `other` is required, the rest follow `Intl.PluralRules`. */
export type Plural = { other: string } & Partial<Record<Intl.LDMLPluralRule, string>>
export type Message = string | Plural

export type Key = keyof typeof en
/** Every language must have every English key. */
export type Dictionary = Record<Key, Message>
export type Params = Record<string, string | number>
