import { useState, type FormEvent } from 'react'
import { auth, type User } from '../api/auth'
import { passwordError } from '../auth/validation'
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
  const title = hasPassword ? 'Change password' : 'Set password'
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <PasswordForm hasPassword={hasPassword} onSaved={onSaved} onClose={onClose} />
    </Dialog>
  )
}

function PasswordForm({ hasPassword, onSaved, onClose }: Omit<Props, 'open'>) {
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
          Password saved. Other devices were signed out.
        </p>
        <div className={dialog.actions}>
          <button type="button" className={`${ui.button} ${ui.primary}`} onClick={onClose}>
            Done
          </button>
        </div>
      </>
    )

  return (
    <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 14 }}>
      {hasPassword ? null : (
        <p>Add a password so you can also sign in with your email address.</p>
      )}
      {error ? (
        <p className={ui.alert} role="alert">
          {error}
        </p>
      ) : null}
      {hasPassword ? (
        <Field
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      ) : null}
      <Field
        label="New password"
        type="password"
        autoComplete="new-password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        error={fieldError}
        hint="At least 8 characters. Other devices will be signed out."
      />
      <div className={dialog.actions}>
        <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={onClose}>
          Cancel
        </button>
        <button className={`${ui.button} ${ui.primary}`}>Save password</button>
      </div>
    </form>
  )
}
