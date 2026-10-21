import { FolderPlus, Menu as MenuIcon, MoreHorizontal, Plus, Star } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { boards as boardApi, type BoardSummary } from '../api/boards'
import { workspaces as workspaceApi, type Workspace } from '../api/workspaces'
import { useI18n } from '../i18n/context'
import { Dialog } from '../ui/Dialog'
import dialog from '../ui/dialog.module.css'
import { InlineText } from '../ui/InlineText'
import { Link } from '../ui/Link'
import { Menu } from '../ui/Menu'
import { useToast } from '../ui/toastContext'
import ui from '../ui/ui.module.css'
import { TemplateTiles } from './TemplateTiles'
import { WhatsNew } from './WhatsNew'
import { WorkspacePanel } from './WorkspacePanel'
import css from './start.module.css'

type Props = {
  boards: BoardSummary[]
  workspaces: Workspace[]
  onNewWorkspace: () => void
  onNewBoard: (workspaceId?: number) => void
  onWorkspacesChange: (workspaces: Workspace[]) => void
  /** A deleted workspace's boards stay, on their own. */
  onWorkspaceDeleted: (workspaceId: number) => void
  /** A board made from a saved template; it opens. */
  onBoardCreated: (board: BoardSummary) => void
  onBoardDeleted: (boardId: number) => void
}

/** After sign-in: workspaces and boards to open, or only the two ways to start when there are none. */
export function StartScreen({ boards, workspaces, onNewWorkspace, onNewBoard, onWorkspacesChange, onWorkspaceDeleted, onBoardCreated, onBoardDeleted }: Props) {
  const { t } = useI18n()
  const toast = useToast()
  const [deleting, setDeleting] = useState<Workspace | null>(null)
  const [deletingBoard, setDeletingBoard] = useState<BoardSummary | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const empty = boards.length === 0 && workspaces.length === 0
  const active = boards.filter((b) => !b.archived)
  const inWorkspace = (id: number) => active.filter((b) => b.workspace_id === id)

  async function rename(workspace: Workspace, name: string) {
    const saved = await workspaceApi.rename(workspace.id, name)
    onWorkspacesChange(workspaces.map((p) => (p.id === saved.id ? saved : p)))
  }

  async function removeBoard(board: BoardSummary) {
    setDeletingBoard(null)
    await boardApi.remove(board.id)
    onBoardDeleted(board.id)
  }

  async function remove(workspace: Workspace) {
    setDeleting(null)
    await workspaceApi.remove(workspace.id)
    onWorkspacesChange(workspaces.filter((p) => p.id !== workspace.id))
    onWorkspaceDeleted(workspace.id)
    toast({ message: t('start.workspaceDeleted') })
  }

  return (
    <div className={css.startLayout} data-empty={empty || undefined}>
    {empty ? null : (
      <div className={css.panelSlot}>
        <button
          type="button"
          className={`${ui.button} ${ui.secondary} ${css.panelToggle}`}
          aria-expanded={panelOpen}
          onClick={() => setPanelOpen(!panelOpen)}
        >
          <MenuIcon size={16} aria-hidden="true" />
          {t('start.panel')}
        </button>
        <div className={css.panelWrap} data-open={panelOpen || undefined}>
          <WorkspacePanel workspaces={workspaces} boards={active} onNewWorkspace={onNewWorkspace} />
        </div>
      </div>
    )}
    <section className={css.start} aria-labelledby="start-title">
      <h1 id="start-title" className={css.startTitle}>
        {t('start.title')}
      </h1>
      <p className={ui.hint}>{t(empty ? 'start.empty' : 'start.intro')}</p>
      <div className={css.choiceCards}>
        <Choice icon={<FolderPlus size={22} aria-hidden="true" />} title={t('start.newWorkspace')} hint={t('start.workspaceHint')} onClick={onNewWorkspace} />
        <Choice icon={<Plus size={22} aria-hidden="true" />} title={t('start.newBoard')} hint={t('start.boardHint')} onClick={() => onNewBoard()} />
      </div>
      {empty ? null : <WhatsNew />}

      <Group onDelete={setDeletingBoard} title={t('start.starred')} boards={active.filter((b) => b.starred)} />
      {workspaces.map((p) => (
        <section key={p.id} className={css.group} aria-label={p.name}>
          <div className={css.groupHead}>
            <h2 className={css.groupTitle}>
              <InlineText value={p.name} label={t('start.renameWorkspace', { name: p.name })} maxLength={100} className={css.groupTitleButton} inputClassName={ui.input} onSave={(name) => rename(p, name)}>
                {p.name}
              </InlineText>
            </h2>
            <span className={ui.hint}>{t('start.boardCount', { count: inWorkspace(p.id).length })}</span>
            <button type="button" className={`${ui.button} ${ui.ghost}`} aria-label={t('start.addBoard', { workspace: p.name })} onClick={() => onNewBoard(p.id)}>
              <Plus size={16} aria-hidden="true" />
              {t('start.addBoardShort')}
            </button>
            <Menu
              label={t('start.workspaceOptions', { name: p.name })}
              align="end"
              triggerClassName={ui.iconButton}
              trigger={<MoreHorizontal size={18} aria-hidden="true" />}
              items={[{ kind: 'action', label: t('start.deleteWorkspace'), danger: true, onSelect: () => setDeleting(p) }]}
            />
          </div>
          {inWorkspace(p.id).length ? <Tiles onDelete={setDeletingBoard} boards={inWorkspace(p.id)} /> : <p className={ui.hint}>{t('start.workspaceEmpty')}</p>}
        </section>
      ))}
      <Group onDelete={setDeletingBoard} title={t('start.boards')} boards={active.filter((b) => b.role === 'admin' && !workspaces.some((p) => p.id === b.workspace_id))} />
      <Group onDelete={setDeletingBoard} title={t('start.shared')} boards={active.filter((b) => b.role !== 'admin')} />
      {empty ? null : <TemplateTiles onCreated={onBoardCreated} />}
      {boards.some((b) => b.archived) ? (
        <details className={css.group}>
          <summary className={css.groupTitle}>{t('start.archived')}</summary>
          <Tiles onDelete={setDeletingBoard} boards={boards.filter((b) => b.archived)} />
        </details>
      ) : null}

      <Dialog open={deletingBoard !== null} onClose={() => setDeletingBoard(null)} title={t('board.deleteTitle')}>
        <p>{t('board.deleteBody', { title: deletingBoard?.title ?? '' })}</p>
        <div className={dialog.actions}>
          <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={() => setDeletingBoard(null)}>
            {t('ui.cancel')}
          </button>
          <button type="button" className={`${ui.button} ${ui.danger}`} onClick={() => deletingBoard && removeBoard(deletingBoard)}>
            {t('board.delete')}
          </button>
        </div>
      </Dialog>
      <Dialog open={deleting !== null} onClose={() => setDeleting(null)} title={t('start.deleteWorkspaceTitle')}>
        <p>{t('start.deleteWorkspaceBody', { name: deleting?.name ?? '' })}</p>
        <div className={dialog.actions}>
          <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={() => setDeleting(null)}>
            {t('ui.cancel')}
          </button>
          <button type="button" className={`${ui.button} ${ui.danger}`} onClick={() => deleting && remove(deleting)}>
            {t('start.deleteWorkspace')}
          </button>
        </div>
      </Dialog>
    </section>
    </div>
  )
}

function Choice({ icon, title, hint, onClick }: { icon: ReactNode; title: string; hint: string; onClick: () => void }) {
  const id = useId()
  return (
    <button type="button" className={css.choiceCard} aria-labelledby={`${id}-t`} aria-describedby={`${id}-h`} onClick={onClick}>
      <span className={css.choiceIcon}>{icon}</span>
      <span id={`${id}-t`} className={css.choiceTitle}>
        {title}
      </span>
      <span id={`${id}-h`} className={css.choiceHint}>
        {hint}
      </span>
    </button>
  )
}

function Group({ title, boards, onDelete }: { title: string; boards: BoardSummary[]; onDelete: (b: BoardSummary) => void }) {
  if (!boards.length) return null
  return (
    <section className={css.group} aria-label={title}>
      <h2 className={css.groupTitle}>{title}</h2>
      <Tiles onDelete={onDelete} boards={boards} />
    </section>
  )
}

function Tiles({ boards, onDelete }: { boards: BoardSummary[]; onDelete: (board: BoardSummary) => void }) {
  const { t } = useI18n()
  return (
    <ul className={css.tiles}>
      {boards.map((b) => {
        const total = b.cards ?? 0
        const done = b.done ?? 0
        return (
          <li key={b.id} className={css.tileSlot}>
            {/* Only the board's admin can delete it; the menu sits beside the link, not inside it. */}
            {b.role === 'admin' ? (
              <Menu
                label={t('start.boardOptions', { name: b.title })}
                align="end"
                className={css.tileMenu}
                triggerClassName={ui.iconButton}
                trigger={<MoreHorizontal size={18} strokeWidth={3} aria-hidden="true" />}
                items={[{ kind: 'action', label: t('board.delete'), danger: true, onSelect: () => onDelete(b) }]}
              />
            ) : null}
            <Link to={`/?board=${b.id}`} className={css.tile}>
              <span className={css.tileTitle} dir="auto">
                {b.title}
                {b.starred ? <Star size={14} className={css.tileStar} aria-hidden="true" /> : null}
              </span>
              <span className={css.tileBar} aria-hidden="true">
                <span style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }} />
              </span>
              <span className={ui.hint}>{total ? t('board.progress', { done, total }) : t('board.noCards')}</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
