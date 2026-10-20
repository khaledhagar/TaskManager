import { useState, type ReactNode } from 'react'
import ui from '../ui/ui.module.css'
import { bind, I18nContext, useI18n } from './context'
import css from './language.module.css'
import { applyLanguage, currentLanguage, saveLanguage } from './language'
import type { Language } from './messages'

/** Holds the current language; switching applies it to the page and saves it in the browser. */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>(currentLanguage)
  const setLanguage = (next: Language) => {
    applyLanguage(next)
    saveLanguage(next)
    setLang(next)
  }
  return <I18nContext value={bind(lang, setLanguage)}>{children}</I18nContext>
}

const NAMES: Record<Language, { full: string; short: string }> = {
  en: { full: 'English', short: 'EN' },
  ar: { full: 'العربية', short: 'ع' },
}

/** Switches between English and Arabic; the label is the other language, shortened on phones. */
export function LanguageButton({ onChange }: { onChange?: (lang: Language) => void }) {
  const { lang, setLanguage } = useI18n()
  const next: Language = lang === 'ar' ? 'en' : 'ar'
  const name = NAMES[next]
  return (
    <button
      type="button"
      className={`${ui.button} ${ui.ghost}`}
      lang={next}
      aria-label={name.full}
      title={name.full}
      onClick={() => {
        setLanguage(next)
        onChange?.(next)
      }}
    >
      <span className={css.full}>{name.full}</span>
      <span className={css.short} aria-hidden="true">
        {name.short}
      </span>
    </button>
  )
}
