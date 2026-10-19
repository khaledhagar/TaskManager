import { useEffect, useRef, useState, type FormEvent } from 'react'
import { auth, type User } from '../api/auth'
import { useLocation } from '../lib/router'
import { Field } from '../ui/Field'
import { Link } from '../ui/Link'
import ui from '../ui/ui.module.css'
import css from './auth.module.css'
import { AuthLayout } from './AuthLayout'
import { emailError, passwordError } from './validation'

const COOLDOWN = 30
const message = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** After sign up: tells the user where the link went and lets them resend it. */
export function CheckInbox() {
  const email = useLocation().params.get('email') ?? ''
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
      setStatus('We sent a new link. It can take a minute to arrive.')
      setUntil(Date.now() + COOLDOWN * 1000)
    } catch (e) {
      setError(message(e))
    }
  }

  return (
    <AuthLayout
      title="Check your inbox"
      intro={
        <>
          We sent a link to <strong>{email}</strong>. Open it to confirm your email and sign in.
          The link works for 24 hours.
        </>
      }
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
        {wait > 0 ? `Resend in ${wait}s` : 'Resend email'}
      </button>
      <p className={css.switch}>
        Wrong address? <Link to="/signup">Sign up again</Link> or <Link to="/signin">sign in</Link>
      </p>
    </AuthLayout>
  )
}

/** Request a password reset link. The answer is the same whether or not the account exists. */
export function ForgotPassword() {
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
    <AuthLayout title="Reset your password" intro="We'll email you a link to choose a new one.">
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
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldError}
        />
        <button className={`${ui.button} ${ui.primary} ${ui.full}`} disabled={busy}>
          Send reset link
        </button>
      </form>
      <p className={css.switch}>
        Remembered it? <Link to="/signin">Sign in</Link>
      </p>
    </AuthLayout>
  )
}

/** Opened from the reset email: choose a new password, then sign in. */
export function ResetPassword({ onSignedIn }: { onSignedIn: (user: User) => void }) {
  const token = useLocation().params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [errors, setErrors] = useState<{ password?: string | null; repeat?: string | null }>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const next = {
      password: passwordError(password),
      repeat: password === repeat ? null : "Passwords don't match.",
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
    <AuthLayout title="Choose a new password" intro="Other devices will be signed out.">
      <form className={css.stack} onSubmit={submit} noValidate>
        {error ? (
          <div className={ui.alert} role="alert">
            {error} <Link to="/forgot-password">Request a new link</Link>
          </div>
        ) : null}
        <Field
          label="New password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint="At least 8 characters."
        />
        <Field
          label="Repeat new password"
          type="password"
          autoComplete="new-password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          error={errors.repeat}
        />
        <button className={`${ui.button} ${ui.primary} ${ui.full}`} disabled={busy}>
          Save new password
        </button>
      </form>
    </AuthLayout>
  )
}

/** Opened from the verification email: confirms the address and signs in. */
export function VerifyEmail({ onSignedIn }: { onSignedIn: (user: User) => void }) {
  const token = useLocation().params.get('token') ?? ''
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    auth.verify(token).then(onSignedIn, (e) => setError(message(e)))
  }, [token, onSignedIn])

  return (
    <AuthLayout title={error ? "We couldn't confirm your email" : 'Confirming your email'}>
      {error ? (
        <>
          <p className={ui.alert} role="alert">
            {error}
          </p>
          <p className={css.switch}>
            <Link to="/signin">Sign in</Link> to request a new link.
          </p>
        </>
      ) : (
        <p className={ui.hint} role="status">
          One moment...
        </p>
      )}
    </AuthLayout>
  )
}
