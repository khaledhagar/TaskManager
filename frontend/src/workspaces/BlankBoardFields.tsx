import { Sparkles } from 'lucide-react'
import { useId, useState } from 'react'
import { ai } from '../api/ai'
import type { Workspace } from '../api/workspaces'
import aiCss from '../ai/ai.module.css'
import { useAiRequest } from '../ai/useAiRequest'
import { useI18n } from '../i18n/context'
import ui from '../ui/ui.module.css'
import { ColumnsEditor } from './ColumnsEditor'

type Props = {
  title: string
  columns: string[]
  onColumns: (columns: string[]) => void
  workspaces: Workspace[]
  workspaceId: number | null
  onWorkspace: (id: number | null) => void
  /** Shown when there is no board name to suggest from. */
  onMissingTitle: () => void
}

/** A blank board's columns (AI can suggest them from the name) and its workspace. */
export function BlankBoardFields({ title, columns, onColumns, workspaces, workspaceId, onWorkspace, onMissingTitle }: Props) {
  const { t } = useI18n()
  const request = useAiRequest()
  const selectId = useId()
  const [fallback, setFallback] = useState(false)
  const workspace = workspaces.find((p) => p.id === workspaceId)?.name ?? null

  async function suggest() {
    if (!title.trim()) return onMissingTitle()
    const answer = await request.run((signal) => ai.suggestColumns([title.trim()], workspace, signal))
    if (!answer) return
    setFallback(!answer.ai)
    onColumns(answer.boards[0].columns)
  }

  return (
    <>
      <ColumnsEditor board={title} columns={columns} onChange={onColumns} />
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
      {request.error ? (
        <p className={ui.alert} role="alert">
          {request.error}
        </p>
      ) : null}
      {fallback ? <p className={ui.notice}>{t('workspace.aiFallback')}</p> : null}
      {workspaces.length ? (
        <div className={ui.field}>
          <label className={ui.label} htmlFor={selectId}>
            {t('newBoard.workspace')}
          </label>
          <select
            id={selectId}
            className={ui.input}
            value={workspaceId ?? ''}
            onChange={(e) => onWorkspace(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">{t('newBoard.noWorkspace')}</option>
            {workspaces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </>
  )
}
