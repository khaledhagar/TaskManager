import { useEffect, useRef, useState, type FormEvent } from 'react'
import { auth, type User } from '../api/auth'
import { useI18n } from '../i18n/context'
import { useLocation } from '../lib/router'
import { Field } from '../ui/Field'
import { Link } from '../ui/Link'
import ui from '../ui/ui.module.css'
import css from './auth.module.css'
import { AuthLayout } from './AuthLayout'
import { PasswordStrength } from './PasswordStrength'
import { emailError, newPasswordError } from './validation'

const COOLDOWN = 30
/** The token from an emailed link; it sits after '#', so it never reaches the server. */
const linkToken = () => new URLSearchParams(location.hash.slice(1)).get('token') ?? ''
const message = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** After sign up: tells the user where the link went and lets them resend it. */
export function CheckInbox() {
  const email = useLocation().params.get('email') ?? ''
  const { t, rich } = useI18n()
  const [until, setUntil] = useState(0)
  const [wait, setWait] = useState(0)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!until) return
    const tick = () => setWait(Math.max(0, Math.ceil((until - Date.now()) / 1000)))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [until])

  async function resend() {
    setError(null)
    try {
      await auth.resend(email)
      setStatus(t('inbox.resent'))
      setUntil(Date.now() + COOLDOWN * 1000)
    } catch (e) {
      setError(message(e))
    }
  }

  return (
    <AuthLayout
      title={t('inbox.title')}
      intro={rich('inbox.sentTo', { email: <strong>{email}</strong> })}
    >
      {status ? (
        <p className={ui.notice} role="status">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className={ui.alert} role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className={`${ui.button} ${ui.secondary} ${ui.full}`}
        onClick={resend}
        disabled={wait > 0 || !email}
      >
        {wait > 0 ? t('inbox.resendIn', { seconds: wait }) : t('inbox.resend')}
      </button>
      <p className={css.switch}>
        {rich('inbox.wrongAddress', {
          signup: <Link to="/signup">{t('inbox.signUpAgain')}</Link>,
          signin: <Link to="/signin">{t('inbox.signInLower')}</Link>,
        })}
      </p>
    </AuthLayout>
  )
}

/** Request a password reset link. The answer is the same whether or not the account exists. */
export function ForgotPassword() {
  const { t, rich } = useI18n()
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const problem = emailError(email)
    setFieldError(problem)
    if (problem) return
    setBusy(true)
    setError(null)
    try {
      setStatus((await auth.forgot(email.trim())).detail)
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title={t('forgot.title')} intro={t('forgot.intro')}>
      <form className={css.stack} onSubmit={submit} noValidate>
        {status ? (
          <p className={ui.notice} role="status">
            {status}
          </p>
        ) : null}
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
          error={fieldError}
        />
        <button className={`${ui.button} ${ui.primary} ${ui.full}`} disabled={busy}>
          {t('forgot.send')}
        </button>
      </form>
      <p className={css.switch}>
        {rich('forgot.remembered', { link: <Link to="/signin">{t('auth.signIn')}</Link> })}
      </p>
    </AuthLayout>
  )
}

/** Opened from the reset email: choose a new password, then sign in. */
export function ResetPassword({ onSignedIn }: { onSignedIn: (user: User) => void }) {
  const token = linkToken()
  const { t } = useI18n()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [errors, setErrors] = useState<{ password?: string | null; repeat?: string | null }>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const next = {
      password: newPasswordError(password),
      repeat: password === repeat ? null : t('reset.mismatch'),
    }
    setErrors(next)
    if (next.password || next.repeat) return
    setBusy(true)
    setError(null)
    try {
      onSignedIn(await auth.reset(token, password))
    } catch (e) {
      setError(message(e))
      setBusy(false)
    }
  }

  return (
    <AuthLayout title={t('reset.title')} intro={t('reset.intro')}>
      <form className={css.stack} onSubmit={submit} noValidate>
        {error ? (
          <div className={ui.alert} role="alert">
            {error} <Link to="/forgot-password">{t('reset.requestLink')}</Link>
          </div>
        ) : null}
        <Field
          label={t('reset.newPassword')}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint={password ? undefined : t('auth.passwordHint')}
        />
        <PasswordStrength password={password} />
        <Field
          label={t('reset.repeat')}
          type="password"
          autoComplete="new-password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          error={errors.repeat}
        />
        <button className={`${ui.button} ${ui.primary} ${ui.full}`} disabled={busy}>
          {t('reset.save')}
        </button>
      </form>
    </AuthLayout>
  )
}

/** Opened from the verification email: confirms the address and signs in. */
export function VerifyEmail({ onSignedIn }: { onSignedIn: (user: User, landing?: string) => void }) {
  const token = linkToken()
  const { t, rich } = useI18n()
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    // A just-verified account opens its demo board.
    auth.verify(token).then((user) => onSignedIn(user, '/?open=first'), (e) => setError(message(e)))
  }, [token, onSignedIn])

  return (
    <AuthLayout title={t(error ? 'verify.failed' : 'verify.confirming')}>
      {error ? (
        <>
          <p className={ui.alert} role="alert">
            {error}
          </p>
          <p className={css.switch}>
            {rich('verify.signInAgain', { link: <Link to="/signin">{t('auth.signIn')}</Link> })}
          </p>
        </>
      ) : (
        <p className={ui.hint} role="status">
          {t('verify.wait')}
        </p>
      )}
    </AuthLayout>
  )
}
