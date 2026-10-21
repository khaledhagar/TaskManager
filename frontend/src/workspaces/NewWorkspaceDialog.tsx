import { Plus, Sparkles, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { ai } from '../api/ai'
import type { BoardSummary } from '../api/boards'
import { workspaces, type Workspace } from '../api/workspaces'
import aiCss from '../ai/ai.module.css'
import { useAiRequest } from '../ai/useAiRequest'
import { useI18n } from '../i18n/context'
import { Dialog } from '../ui/Dialog'
import dialog from '../ui/dialog.module.css'
import { Field } from '../ui/Field'
import ui from '../ui/ui.module.css'
import { cleanColumns, defaultColumns } from './columns'
import { ColumnsEditor } from './ColumnsEditor'
import css from './editor.module.css'

const MAX_BOARDS = 10
type Props = { open: boolean; onClose: () => void; onCreated: (workspace: Workspace, boards: BoardSummary[]) => void }
type Row = { key: number; title: string; columns: string[] }

/** A workspace with its related boards; AI can suggest every board's columns in one request. */
export function NewWorkspaceDialog({ open, onClose, onCreated }: Props) {
  const { t } = useI18n()
  return (
    <Dialog open={open} onClose={onClose} title={t('start.newWorkspace')}>
      {open ? <WorkspaceForm onClose={onClose} onCreated={onCreated} /> : null}
    </Dialog>
  )
}

let nextKey = 0
const newRow = (title = ''): Row => ({ key: nextKey++, title, columns: defaultColumns() })

function WorkspaceForm({ onClose, onCreated }: Omit<Props, 'open'>) {
  const { t } = useI18n()
  const request = useAiRequest()
  const [name, setName] = useState('')
  const [rows, setRows] = useState<Row[]>(() => [newRow()])
  const [nameError, setNameError] = useState<string | null>(null)
  const [boardError, setBoardError] = useState<string | null>(null)
  const [fallback, setFallback] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const update = (key: number, changes: Partial<Row>) =>
    setRows((all) => all.map((r) => (r.key === key ? { ...r, ...changes } : r)))

  function check() {
    setNameError(name.trim() ? null : t('workspace.nameMissing'))
    setBoardError(rows.every((r) => r.title.trim()) ? null : t('workspace.boardMissing'))
    return Boolean(name.trim()) && rows.every((r) => r.title.trim())
  }

  async function suggest() {
    if (!check()) return
    const answer = await request.run((signal) => ai.suggestColumns(rows.map((r) => r.title.trim()), name.trim(), signal))
    if (!answer) return
    setFallback(!answer.ai)
    setRows((all) => all.map((r, i) => ({ ...r, columns: answer.boards[i]?.columns ?? r.columns })))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!check()) return
    setBusy(true)
    try {
      const made = await workspaces.create(name.trim(), rows.map((r) => ({ title: r.title.trim(), columns: cleanColumns(r.columns) })))
      onCreated(made.workspace, made.boards)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className={css.form}>
      <p className={ui.notice}>{t('start.workspaceHint')}</p>
      {error ?? request.error ? (
        <p className={ui.alert} role="alert">
          {error ?? request.error}
        </p>
      ) : null}
      <Field
        label={t('workspace.name')}
        value={name}
        maxLength={100}
        autoFocus
        dir="auto"
        placeholder={t('workspace.namePlaceholder')}
        onChange={(e) => setName(e.target.value)}
        error={nameError}
      />
      <fieldset className={css.boards}>
        <legend className={ui.label}>{t('workspace.boards')}</legend>
        {rows.map((row, i) => (
          <div key={row.key} className={css.boardRow}>
            <div className={css.boardName}>
              <Field
                label={t('workspace.boardName', { number: i + 1 })}
                value={row.title}
                maxLength={200}
                dir="auto"
                placeholder={i === 0 ? t('workspace.boardPlaceholder') : undefined}
                onChange={(e) => update(row.key, { title: e.target.value })}
              />
              {rows.length > 1 ? (
                <button
                  type="button"
                  className={ui.iconButton}
                  aria-label={t('workspace.removeBoard', { number: i + 1 })}
                  onClick={() => setRows((all) => all.filter((r) => r.key !== row.key))}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              ) : null}
            </div>
            <ColumnsEditor board={row.title} columns={row.columns} onChange={(columns) => update(row.key, { columns })} />
          </div>
        ))}
        {boardError ? <p className={ui.fieldError}>{boardError}</p> : null}
        {rows.length < MAX_BOARDS ? (
          <button type="button" className={`${ui.button} ${ui.ghost}`} onClick={() => setRows((all) => [...all, newRow()])}>
            <Plus size={16} aria-hidden="true" />
            {t('workspace.addBoard')}
          </button>
        ) : null}
      </fieldset>

      <div className={aiCss.row}>
        <button type="button" className={`${ui.button} ${ui.secondary}`} disabled={request.busy} onClick={suggest}>
          <Sparkles size={16} aria-hidden="true" />
          {t('workspace.suggest')}
        </button>
        {request.busy ? (
          <>
            <span className={ui.hint} role="status">
              {t('workspace.suggesting')}
            </span>
            <button type="button" className={ui.linkButton} onClick={request.cancel}>
              {t('ai.cancelRequest')}
            </button>
          </>
        ) : null}
      </div>
      <p className={ui.hint}>{t('workspace.aiNote')}</p>
      {fallback ? <p className={ui.notice}>{t('workspace.aiFallback')}</p> : null}

      <p className={css.summary}>
        {t('workspace.summary', { name: name.trim() || '...', count: rows.length })}
      </p>
      <div className={dialog.actions}>
        <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={onClose}>
          {t('ui.cancel')}
        </button>
        <button className={`${ui.button} ${ui.primary}`} disabled={busy || request.busy}>
          {t('workspace.create')}
        </button>
      </div>
    </form>
  )
}
