import { useEffect, useState } from 'react'
import type { User } from '../api/auth'
import { sharing, type InvitePreview } from '../api/sharing'
import authCss from '../auth/auth.module.css'
import { AuthLayout } from '../auth/AuthLayout'
import { useI18n } from '../i18n/context'
import { navigate } from '../lib/router'
import { Link } from '../ui/Link'
import ui from '../ui/ui.module.css'
import { inviteToken, remember } from './inviteStore'

type Props = { user: User | null; onSignOut: () => void }

/** /invite#token=...: shows who invited whom to which board, then Accept. */
export function InvitePage({ user, onSignOut }: Props) {
  const { t } = useI18n()
  const [token] = useState(inviteToken)
  const [preview, setPreview] = useState<InvitePreview | null>(null)
  const [invalid, setInvalid] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    sharing.preview(token).then(
      (p) => {
        setPreview(p)
        if (!user) remember(token)
      },
      () => {
        setInvalid(true)
        remember(null)
      },
    )
  }, [token, user])

  async function accept() {
    setBusy(true)
    setError(null)
    try {
      const board = await sharing.accept(token)
      remember(null)
      navigate(`/?board=${board.id}`, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  if (invalid)
    return (
      <AuthLayout title={t('invite.title')} intro={t('invite.invalid')}>
        <Link to="/">{t('invite.home')}</Link>
      </AuthLayout>
    )
  if (!preview) return <div role="status" aria-label={t('app.loading')} />

  const body = t('invite.body', { inviter: preview.invited_by ?? '', board: preview.board_title })
  return (
    <AuthLayout title={t('invite.title')} intro={body}>
      <div className={authCss.stack}>
        <p>{t('invite.forEmail', { email: preview.email })}</p>
        {error ? (
          <div className={ui.alert} role="alert">
            {error}
          </div>
        ) : null}
        {user ? (
          <>
            <button type="button" className={`${ui.button} ${ui.primary} ${ui.full}`} disabled={busy} onClick={accept}>
              {t('invite.accept')}
            </button>
            {error ? (
              <button type="button" className={ui.linkButton} onClick={onSignOut}>
                {t('invite.switch')}
              </button>
            ) : null}
          </>
        ) : (
          <>
            <p className={ui.hint}>{t('invite.signInFirst', { email: preview.email })}</p>
            <Link to="/signin" className={`${ui.button} ${ui.primary} ${ui.full}`}>
              {t('invite.signIn')}
            </Link>
            <Link to="/signup" className={`${ui.button} ${ui.secondary} ${ui.full}`}>
              {t('invite.signUp')}
            </Link>
          </>
        )}
      </div>
    </AuthLayout>
  )
}
