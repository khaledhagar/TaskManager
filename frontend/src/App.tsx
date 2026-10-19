import { useCallback, useEffect, useState } from 'react'
import { auth, type User } from './api/auth'
import { CheckInbox, ForgotPassword, ResetPassword, VerifyEmail } from './auth/AccountPages'
import { AuthScreen } from './auth/AuthScreen'
import { navigate, useLocation } from './lib/router'
import { AppShell } from './shell/AppShell'

const SIGNED_OUT_ONLY = ['/signin', '/signup']

/** Loads the session, then shows the account page for the URL or the signed-in app. */
export default function App() {
  const { path } = useLocation()
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    // Only fill in the first answer: a sign-in that finished earlier (e.g. /verify) wins.
    const settle = (value: User | null) => setUser((current) => (current === undefined ? value : current))
    auth.me().then(settle, () => settle(null))
  }, [])

  const signedIn = useCallback((next: User) => {
    setUser(next)
    navigate('/', { replace: true })
  }, [])

  useEffect(() => {
    if (user && SIGNED_OUT_ONLY.includes(path)) navigate('/', { replace: true })
  }, [user, path])

  if (path === '/verify') return <VerifyEmail onSignedIn={signedIn} />
  if (path === '/reset-password') return <ResetPassword onSignedIn={signedIn} />
  if (path === '/check-inbox') return <CheckInbox />
  if (path === '/forgot-password') return <ForgotPassword />
  if (user === undefined) return <div role="status" aria-label="Loading" />
  if (user === null) return <AuthScreen onSignedIn={signedIn} />
  return (
    <AppShell
      user={user}
      onUserChange={setUser}
      onSignedOut={() => {
        setUser(null)
        navigate('/signin', { replace: true })
      }}
    />
  )
}
