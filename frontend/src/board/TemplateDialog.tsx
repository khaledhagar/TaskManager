import { useState, type FormEvent } from 'react'
import { templates } from '../api/templates'
import { useI18n } from '../i18n/context'
import { Dialog } from '../ui/Dialog'
import dialog from '../ui/dialog.module.css'
import { Field } from '../ui/Field'
import { useToast } from '../ui/toastContext'
import ui from '../ui/ui.module.css'

type Props = { open: boolean; onClose: () => void; boardId: number; boardTitle: string }

/** Board menu "Save as template": a private template for the New board dialog. */
export function TemplateDialog({ open, onClose, boardId, boardTitle }: Props) {
  const { t } = useI18n()
  return (
    <Dialog open={open} onClose={onClose} title={t('board.saveTemplate')}>
      {open ? <TemplateForm onClose={onClose} boardId={boardId} boardTitle={boardTitle} /> : null}
    </Dialog>
  )
}

function TemplateForm({ onClose, boardId, boardTitle }: Omit<Props, 'open'>) {
  const { t } = useI18n()
  const toast = useToast()
  const [name, setName] = useState(boardTitle)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return setError(t('template.nameMissing'))
    setBusy(true)
    try {
      const saved = await templates.save(boardId, name.trim())
      toast({ message: t('board.templateSaved', { name: saved.name }) })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 14 }}>
      <Field
        label={t('template.name')}
        value={name}
        maxLength={200}
        autoFocus
        dir="auto"
        onChange={(e) => setName(e.target.value)}
        error={error}
        hint={t('template.hint')}
      />
      <div className={dialog.actions}>
        <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={onClose}>
          {t('ui.cancel')}
        </button>
        <button className={`${ui.button} ${ui.primary}`} disabled={busy}>
          {t('ui.save')}
        </button>
      </div>
    </form>
  )
}
