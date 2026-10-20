import { useState, type FormEvent } from 'react'
import { auth, type User } from '../api/auth'
import { passwordError } from '../auth/validation'
import { useI18n } from '../i18n/context'
import { Dialog } from '../ui/Dialog'
import dialog from '../ui/dialog.module.css'
import { Field } from '../ui/Field'
import ui from '../ui/ui.module.css'

type Props = {
  open: boolean
  onClose: () => void
  hasPassword: boolean
  onSaved: (user: User) => void
}

/** Change the password, or set a first one for accounts that sign in with Google. */
export function PasswordDialog({ open, onClose, hasPassword, onSaved }: Props) {
  const { t } = useI18n()
  const title = t(hasPassword ? 'account.changePassword' : 'account.setPassword')
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <PasswordForm hasPassword={hasPassword} onSaved={onSaved} onClose={onClose} />
    </Dialog>
  )
}

function PasswordForm({ hasPassword, onSaved, onClose }: Omit<Props, 'open'>) {
  const { t } = useI18n()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const problem = passwordError(next)
    setFieldError(problem)
    if (problem) return
    setError(null)
    try {
      onSaved(await auth.changePassword(hasPassword ? current : null, next))
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  if (saved)
    return (
      <>
        <p className={ui.notice} role="status">
          {t('password.saved')}
        </p>
        <div className={dialog.actions}>
          <button type="button" className={`${ui.button} ${ui.primary}`} onClick={onClose}>
            {t('ui.done')}
          </button>
        </div>
      </>
    )

  return (
    <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 14 }}>
      {hasPassword ? null : (
        <p>{t('password.addIntro')}</p>
      )}
      {error ? (
        <p className={ui.alert} role="alert">
          {error}
        </p>
      ) : null}
      {hasPassword ? (
        <Field
          label={t('password.current')}
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      ) : null}
      <Field
        label={t('reset.newPassword')}
        type="password"
        autoComplete="new-password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        error={fieldError}
        hint={t('password.hint')}
      />
      <div className={dialog.actions}>
        <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={onClose}>
          {t('ui.cancel')}
        </button>
        <button className={`${ui.button} ${ui.primary}`}>{t('password.save')}</button>
      </div>
    </form>
  )
}
