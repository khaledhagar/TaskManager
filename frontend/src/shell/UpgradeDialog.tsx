import { useEffect, useState, type FormEvent } from 'react'
import { auth, GOOGLE_LOGIN_URL } from '../api/auth'
import authCss from '../auth/auth.module.css'
import { GoogleButton } from '../auth/GoogleButton'
import { emailError, passwordError } from '../auth/validation'
import { useI18n } from '../i18n/context'
import { Dialog } from '../ui/Dialog'
import { Field } from '../ui/Field'
import ui from '../ui/ui.module.css'

/** Turn a guest into a real account (Google or email), keeping the guest's boards. */
export function UpgradeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n()
  return (
    <Dialog open={open} onClose={onClose} title={t('shell.saveBoards')}>
      <UpgradeForm />
    </Dialog>
  )
}

function UpgradeForm() {
  const { t } = useI18n()
  const [google, setGoogle] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null }>({})
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  useEffect(() => {
    auth.config().then((c) => setGoogle(c.google), () => setGoogle(false))
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const next = { email: emailError(email), password: passwordError(password) }
    setErrors(next)
    if (next.email || next.password) return
    setError(null)
    try {
      setSentTo((await auth.upgrade({ email: email.trim(), password })).email)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  if (sentTo)
    return (
      <p className={ui.notice} role="status">
        {t('upgrade.sentTo', { email: sentTo })}
      </p>
    )

  return (
    <div className={authCss.stack}>
      <p>{t('upgrade.intro')}</p>
      {google ? (
        <>
          <GoogleButton href={GOOGLE_LOGIN_URL} />
          <div className={authCss.divider}>{t('auth.orEmail')}</div>
        </>
      ) : null}
      <form className={authCss.stack} onSubmit={submit} noValidate>
        {error ? (
          <p className={ui.alert} role="alert">
            {error}
          </p>
        ) : null}
        <Field
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <Field
          label={t('auth.password')}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint={t('auth.passwordHint')}
        />
        <button className={`${ui.button} ${ui.primary} ${ui.full}`}>{t('auth.createAccount')}</button>
      </form>
    </div>
  )
}
