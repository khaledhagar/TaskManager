import { useI18n } from '../i18n/context'
import { strength, strengthHint } from './strength'
import css from './strength.module.css'

const STEPS = { weak: 1, medium: 2, strong: 3 } as const

/** Live strength meter for a new password: a 3-step bar, the word, and one hint. */
export function PasswordStrength({ password, email = '' }: { password: string; email?: string }) {
  const { t } = useI18n()
  if (!password) return null
  const level = strength(password, email)
  const hint = strengthHint(password, email)
  const word = t(`strength.${level}`)
  return (
    <div className={css.strength} data-level={level}>
      <div
        role="meter"
        aria-label={t('strength.title')}
        aria-valuemin={0}
        aria-valuemax={3}
        aria-valuenow={STEPS[level]}
        aria-valuetext={word}
        className={css.bar}
      >
        {[1, 2, 3].map((step) => (
          <span key={step} className={step <= STEPS[level] ? css.on : css.off} />
        ))}
      </div>
      <p role="status" className={css.text}>
        <strong>{t('strength.label', { level: word })}</strong>
        {hint ? <span> {t(hint)}</span> : null}
      </p>
    </div>
  )
}
