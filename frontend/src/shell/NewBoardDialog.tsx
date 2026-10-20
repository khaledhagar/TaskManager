import { useState, type FormEvent } from 'react'
import { useI18n } from '../i18n/context'
import { Dialog } from '../ui/Dialog'
import dialog from '../ui/dialog.module.css'
import { Field } from '../ui/Field'
import ui from '../ui/ui.module.css'

type Props = { open: boolean; onClose: () => void; onCreate: (title: string) => Promise<void> }

/** Name a new board; it starts with To Do, In Progress and Done. */
export function NewBoardDialog({ open, onClose, onCreate }: Props) {
  const { t } = useI18n()
  return (
    <Dialog open={open} onClose={onClose} title={t('shell.newBoard')}>
      <NewBoardForm onClose={onClose} onCreate={onCreate} />
    </Dialog>
  )
}

function NewBoardForm({ onClose, onCreate }: Omit<Props, 'open'>) {
  const { t } = useI18n()
  const [title, setTitle] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return setFieldError(t('newBoard.nameMissing'))
    setBusy(true)
    try {
      await onCreate(title.trim())
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 14 }}>
      {error ? (
        <p className={ui.alert} role="alert">
          {error}
        </p>
      ) : null}
      <Field
        label={t('newBoard.name')}
        value={title}
        maxLength={200}
        autoFocus
        placeholder={t('newBoard.placeholder')}
        onChange={(e) => setTitle(e.target.value)}
        error={fieldError}
        hint={t('newBoard.hint')}
      />
      <div className={dialog.actions}>
        <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={onClose}>
          {t('ui.cancel')}
        </button>
        <button className={`${ui.button} ${ui.primary}`} disabled={busy}>
          {t('newBoard.create')}
        </button>
      </div>
    </form>
  )
}
