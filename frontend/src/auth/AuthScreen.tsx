import { useEffect, useState, type FormEvent } from 'react'
import { auth, GOOGLE_LOGIN_URL, type User } from '../api/auth'
import { ApiError } from '../api/client'
import { navigate, useLocation } from '../lib/router'
import { Field } from '../ui/Field'
import { Link } from '../ui/Link'
import ui from '../ui/ui.module.css'
import css from './auth.module.css'
import { AuthLayout } from './AuthLayout'
import { GoogleButton } from './GoogleButton'
import { emailError, passwordError } from './validation'

type Errors = { email?: string | null; password?: string | null }

/** Sign in at /signin, sign up at /signup; Google and guest are offered on both. */
export function AuthScreen({ onSignedIn }: { onSignedIn: (user: User) => void }) {
  const { path, params } = useLocation()
  const signup = path === '/signup'
  const [google, setGoogle] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(
    params.get('error') === 'google'
      ? "Google sign-in didn't complete. Try again, or use your email."
      : null,
  )
  const [unverified, setUnverified] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    auth.config().then((c) => setGoogle(c.google), () => setGoogle(false))
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const next = { email: emailError(email), password: passwordError(password) }
    setErrors(next)
    setFormError(null)
    setUnverified(false)
    if (next.email || next.password) return
    setBusy(true)
    try {
      const body = { email: email.trim(), password }
      if (signup) {
        await auth.signUp(body)
        navigate(`/check-inbox?${new URLSearchParams({ email: body.email })}`)
      } else {
        onSignedIn(await auth.signIn(body))
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) setUnverified(true)
      else setFormError(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function continueAsGuest() {
    setBusy(true)
    try {
      onSignedIn(await auth.guest())
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error))
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title={signup ? 'Create your account' : 'Sign in to Task Manager'}
      intro={signup ? 'Free to use. Your boards are visible only to you.' : undefined}
    >
      {google ? (
        <>
          <GoogleButton href={GOOGLE_LOGIN_URL} />
          <div className={css.divider}>or use your email</div>
        </>
      ) : null}

      <form className={css.stack} onSubmit={submit} noValidate>
        {formError ? (
          <p className={ui.alert} role="alert">
            {formError}
          </p>
        ) : null}
        {unverified ? (
          <p className={ui.notice} role="status">
            Verify your email to sign in.{' '}
            <button
              type="button"
              className={ui.linkButton}
              onClick={() => navigate(`/check-inbox?${new URLSearchParams({ email: email.trim() })}`)}
            >
              Send a new link
            </button>
          </p>
        ) : null}
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <Field
          label="Password"
          type="password"
          autoComplete={signup ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint={signup ? 'At least 8 characters.' : undefined}
        />
        {signup ? null : (
          <Link to="/forgot-password" className={css.forgot}>
            Forgot password?
          </Link>
        )}
        <button className={`${ui.button} ${ui.primary} ${ui.full}`} disabled={busy}>
          {signup ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <div className={css.stack}>
        <button
          type="button"
          className={`${ui.button} ${ui.secondary} ${ui.full}`}
          onClick={continueAsGuest}
          disabled={busy}
        >
          Continue as guest
        </button>
        <p className={ui.hint}>Try it without an account. Guest boards are removed after 7 days.</p>
      </div>

      <p className={css.switch}>
        {signup ? 'Already have an account? ' : 'New here? '}
        <Link to={signup ? '/signin' : '/signup'}>{signup ? 'Sign in' : 'Create an account'}</Link>
      </p>
    </AuthLayout>
  )
}
