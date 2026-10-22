import { useI18n } from '../i18n/context'
import { LanguageButton } from '../i18n/I18n'
import { Link } from '../ui/Link'
import { Logo } from '../ui/Logo'
import css from './privacy.module.css'

const CONTACT = 'datasharingks@gmail.com'
const SECTIONS = ['keep', 'google', 'use', 'services', 'cookies', 'delete'] as const

/** /privacy: the public privacy policy, open signed in or out (Google asks for one). */
export function PrivacyPage() {
  const { t, rich } = useI18n()
  return (
    <div className={css.page}>
      <header className={css.header}>
        <Link to="/" className={css.home}>
          <Logo />
        </Link>
        <LanguageButton />
      </header>
      <main className={css.article}>
        <h1 className={css.title}>{t('privacy.title')}</h1>
        <p className={css.muted}>{t('privacy.updated')}</p>
        <p>{t('privacy.intro')}</p>
        {SECTIONS.map((name) => (
          <section key={name} className={css.section}>
            <h2 className={css.heading}>{t(`privacy.${name}.title`)}</h2>
            <p>{t(`privacy.${name}.body`)}</p>
          </section>
        ))}
        <section className={css.section}>
          <h2 className={css.heading}>{t('privacy.contact.title')}</h2>
          <p>{rich('privacy.contact.body', { email: <a href={`mailto:${CONTACT}`}>{CONTACT}</a> })}</p>
        </section>
      </main>
    </div>
  )
}
