import { ChevronDown, FolderPlus, Users } from 'lucide-react'
import { useId, useState } from 'react'
import type { BoardSummary } from '../api/boards'
import type { Workspace } from '../api/workspaces'
import { useI18n } from '../i18n/context'
import { Link } from '../ui/Link'
import ui from '../ui/ui.module.css'
import { MembersDialog } from './MembersDialog'
import css from './panel.module.css'

type Props = {
  workspaces: Workspace[]
  /** Active boards (not archived). */
  boards: BoardSummary[]
  onNewWorkspace: () => void
}

/** Start page left panel: each workspace with its Boards and Members, then the other boards. */
export function WorkspacePanel({ workspaces, boards, onNewWorkspace }: Props) {
  const { t } = useI18n()
  const [members, setMembers] = useState<{ id: number | 'none'; name: string } | null>(null)
  const inWorkspace = (b: BoardSummary) => workspaces.some((w) => w.id === b.workspace_id)
  return (
    <nav className={css.panel} aria-label={t('start.panel')}>
      <h2 className={css.panelTitle}>{t('start.workspaces')}</h2>
      {workspaces.map((w) => (
        <Group
          key={w.id}
          name={w.name}
          boards={boards.filter((b) => b.workspace_id === w.id)}
          onMembers={() => setMembers({ id: w.id, name: w.name })}
        />
      ))}
      <Group
        name={t('start.boards')}
        boards={boards.filter((b) => b.role === 'admin' && !inWorkspace(b))}
        onMembers={() => setMembers({ id: 'none', name: t('start.boards') })}
      />
      <Group name={t('start.shared')} boards={boards.filter((b) => b.role !== 'admin')} />
      <button type="button" className={`${ui.button} ${ui.ghost} ${css.panelNew}`} onClick={onNewWorkspace}>
        <FolderPlus size={16} aria-hidden="true" />
        {t('start.newWorkspace')}
      </button>
      <MembersDialog target={members} onClose={() => setMembers(null)} />
    </nav>
  )
}

type GroupProps = { name: string; boards: BoardSummary[]; onMembers?: () => void }

function Group({ name, boards, onMembers }: GroupProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const listId = useId()
  return (
    <div className={css.panelGroup}>
      <span className={css.panelName} dir="auto">
        {name}
      </span>
      <div className={css.panelButtons}>
        <button
          type="button"
          className={css.panelButton}
          aria-expanded={open}
          aria-controls={listId}
          aria-label={t('start.boardsIn', { name })}
          onClick={() => setOpen(!open)}
        >
          {t('start.showBoards')} ({boards.length})
          <ChevronDown size={14} className={css.chevron} data-open={open || undefined} aria-hidden="true" />
        </button>
        {onMembers ? (
          <button type="button" className={css.panelButton} aria-label={t('start.membersOf', { name })} onClick={onMembers}>
            <Users size={14} aria-hidden="true" />
            {t('start.showMembers')}
          </button>
        ) : null}
      </div>
      {open ? (
        <ul id={listId} className={css.panelList}>
          {boards.length ? (
            boards.map((b) => (
              <li key={b.id}>
                <Link to={`/?board=${b.id}`} className={css.panelLink} dir="auto">
                  {b.title}
                </Link>
              </li>
            ))
          ) : (
            <li className={ui.hint}>{t('start.noBoardsHere')}</li>
          )}
        </ul>
      ) : null}
    </div>
  )
}
