import { useState, type FormEvent } from 'react'
import { sharing, type InviteLink } from '../api/sharing'
import { emailError } from '../auth/validation'
import { useI18n } from '../i18n/context'
import { Field } from '../ui/Field'
import ui from '../ui/ui.module.css'
import css from './sharing.module.css'

type Props = { boardId: number; onInvited: (invite: InviteLink) => void }

/** Email field that sends an invitation; the panel then shows its link to copy or share. */
export function InviteForm({ boardId, onInvited }: Props) {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const problem = emailError(email)
    setError(problem)
    if (problem) return
    setBusy(true)
    try {
      onInvited(await sharing.invite(boardId, email.trim()))
      setEmail('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className={css.inviteForm} onSubmit={submit} noValidate>
      <Field
        label={t('members.inviteLabel')}
        type="email"
        autoComplete="off"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={error}
        hint={t('members.inviteHint')}
      />
      <button className={`${ui.button} ${ui.primary}`} disabled={busy}>
        {t('members.invite')}
      </button>
    </form>
  )
}
