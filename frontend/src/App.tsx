import { useCallback, useEffect, useState } from 'react'
import { auth, type User } from './api/auth'
import { CheckInbox, ForgotPassword, ResetPassword, VerifyEmail } from './auth/AccountPages'
import { AuthScreen } from './auth/AuthScreen'
import { useI18n } from './i18n/context'
import { hasSavedLanguage } from './i18n/language'
import { navigate, useLocation } from './lib/router'
import { InvitePage } from './sharing/InvitePage'
import { savedInvite, takeReturn } from './sharing/inviteStore'
import { PublicBoardPage } from './sharing/PublicBoardPage'
import { AppShell } from './shell/AppShell'

const SIGNED_OUT_ONLY = ['/signin', '/signup']

/** Loads the session, then shows the account page for the URL or the signed-in app. */
export default function App() {
  const { path } = useLocation()
  const { t, lang, setLanguage } = useI18n()
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    // Only fill in the first answer: a sign-in that finished earlier (e.g. /verify) wins.
    const settle = (value: User | null) => setUser((current) => (current === undefined ? value : current))
    auth.me().then(settle, () => settle(null))
  }, [])

  // On sign-in: a choice saved in this browser wins; otherwise use the account's language.
  const userId = user?.id
  useEffect(() => {
    if (!user) return
    if (!hasSavedLanguage()) setLanguage(user.language)
    else if (user.language !== lang) auth.setLanguage(lang).then(setUser)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when a different user signs in
  }, [userId])

  // After signing in, go back to an invitation the user opened while signed out.
  const signedIn = useCallback((next: User) => {
    setUser(next)
    navigate(savedInvite() ? '/invite' : (takeReturn() ?? '/'), { replace: true })
  }, [])

  useEffect(() => {
    if (user && SIGNED_OUT_ONLY.includes(path)) navigate('/', { replace: true })
  }, [user, path])

  if (path === '/verify') return <VerifyEmail onSignedIn={signedIn} />
  if (path === '/reset-password') return <ResetPassword onSignedIn={signedIn} />
  if (path === '/check-inbox') return <CheckInbox />
  if (path === '/forgot-password') return <ForgotPassword />
  if (user === undefined) return <div role="status" aria-label={t('app.loading')} />
  if (path.startsWith('/p/')) return <PublicBoardPage token={path.slice(3)} user={user} />
  if (path === '/invite')
    return <InvitePage user={user} onSignOut={() => auth.signOut().then(() => setUser(null))} />
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
