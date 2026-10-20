import type { ReactNode } from 'react'
import { useI18n } from '../i18n/context'
import { LanguageButton } from '../i18n/I18n'
import { Logo } from '../ui/Logo'
import css from './auth.module.css'
import { WallPreview } from './WallPreview'

/** Split screen: the brand wall at the start side (hidden on small screens), the form at the end side. */
export function AuthLayout({ title, intro, children }: {
  title: string
  intro?: ReactNode
  children: ReactNode
}) {
  const { t } = useI18n()
  return (
    <div className={css.layout}>
      <aside className={css.brand}>
        <Logo inverted />
        <div className={css.brandCopy}>
          <p className={css.brandHeadline}>{t('auth.brandHeadline')}</p>
          <p className={css.brandSub}>{t('auth.brandSub')}</p>
        </div>
        <WallPreview />
      </aside>
      <main className={css.panel}>
        <div className={css.language}>
          <LanguageButton />
        </div>
        <div className={css.form}>
          <div className={css.mobileLogo}>
            <Logo />
          </div>
          <h1 className={css.title}>{title}</h1>
          {intro ? <div className={css.intro}>{intro}</div> : null}
          {children}
        </div>
      </main>
    </div>
  )
}
