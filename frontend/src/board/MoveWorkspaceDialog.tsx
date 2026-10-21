import { useId, useState, type FormEvent } from 'react'
import type { Workspace } from '../api/workspaces'
import { useI18n } from '../i18n/context'
import { Dialog } from '../ui/Dialog'
import dialog from '../ui/dialog.module.css'
import ui from '../ui/ui.module.css'

type Props = {
  open: boolean
  onClose: () => void
  boardTitle: string
  workspaces: Workspace[]
  current: number | null
  onMove: (workspaceId: number | null) => void
}

/** Board menu "Move to workspace" (the board's admin): one of the admin's workspaces, or none. */
export function MoveWorkspaceDialog({ open, onClose, boardTitle, workspaces, current, onMove }: Props) {
  const { t } = useI18n()
  return (
    <Dialog open={open} onClose={onClose} title={t('board.moveWorkspace')}>
      {open ? <MoveForm onClose={onClose} boardTitle={boardTitle} workspaces={workspaces} current={current} onMove={onMove} /> : null}
    </Dialog>
  )
}

function MoveForm({ onClose, boardTitle, workspaces, current, onMove }: Omit<Props, 'open'>) {
  const { t } = useI18n()
  const id = useId()
  const [choice, setChoice] = useState(current)

  function submit(event: FormEvent) {
    event.preventDefault()
    onMove(choice)
    onClose()
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
      <div className={ui.field}>
        <label className={ui.label} htmlFor={id}>
          {t('move.label', { board: boardTitle })}
        </label>
        <select id={id} className={ui.input} value={choice ?? ''} onChange={(e) => setChoice(e.target.value ? Number(e.target.value) : null)}>
          <option value="">{t('newBoard.noWorkspace')}</option>
          {workspaces.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className={dialog.actions}>
        <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={onClose}>
          {t('ui.cancel')}
        </button>
        <button className={`${ui.button} ${ui.primary}`}>{t('ui.save')}</button>
      </div>
    </form>
  )
}
