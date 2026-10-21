import { useState, type FormEvent } from 'react'
import type { Column } from '../api/boards'
import { useI18n } from '../i18n/context'
import { Dialog } from '../ui/Dialog'
import dialog from '../ui/dialog.module.css'
import { Field } from '../ui/Field'
import ui from '../ui/ui.module.css'

type Props = { column: Column | null; onClose: () => void; onSave: (limit: number | null) => void }

/** Column menu "Set WIP limit": warns when a column holds too many cards; never blocks. */
export function WipDialog({ column, onClose, onSave }: Props) {
  const { t } = useI18n()
  return (
    <Dialog open={column !== null} onClose={onClose} title={t('wip.title')}>
      {column ? <WipForm key={column.id} column={column} onClose={onClose} onSave={onSave} /> : null}
    </Dialog>
  )
}

function WipForm({ column, onClose, onSave }: Props & { column: Column }) {
  const { t } = useI18n()
  const [value, setValue] = useState(column.wip_limit ? String(column.wip_limit) : '')
  const [error, setError] = useState<string | null>(null)

  function save(limit: number | null) {
    onSave(limit)
    onClose()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!value.trim()) return save(null)
    const limit = Number(value)
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) return setError(t('wip.invalid'))
    save(limit)
  }

  return (
    <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 14 }}>
      <Field
        label={t('wip.label', { column: column.title })}
        type="number"
        inputMode="numeric"
        min={1}
        max={100}
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        error={error}
        hint={t('wip.hint')}
      />
      <div className={dialog.actions}>
        {column.wip_limit ? (
          <button type="button" className={`${ui.button} ${ui.ghost}`} onClick={() => save(null)}>
            {t('wip.remove')}
          </button>
        ) : null}
        <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={onClose}>
          {t('ui.cancel')}
        </button>
        <button className={`${ui.button} ${ui.primary}`}>{t('ui.save')}</button>
      </div>
    </form>
  )
}
