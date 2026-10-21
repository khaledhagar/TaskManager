import { LayoutGrid, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { auth, type User } from '../api/auth'
import { boards, type BoardSummary } from '../api/boards'
import { workspaces as workspaceApi, type Workspace } from '../api/workspaces'
import { BoardView } from '../board/BoardView'
import { useI18n } from '../i18n/context'
import { LanguageButton } from '../i18n/I18n'
import { navigate, useLocation } from '../lib/router'
import { NewWorkspaceDialog } from '../workspaces/NewWorkspaceDialog'
import { StartScreen } from '../workspaces/StartScreen'
import { Logo } from '../ui/Logo'
import { useToast } from '../ui/toastContext'
import ui from '../ui/ui.module.css'
import { AccountMenu } from './AccountMenu'
import { firstBoard } from './boardSections'
import { BoardSwitcher } from './BoardSwitcher'
import { NewBoardDialog } from './NewBoardDialog'
import { NotificationBell } from './NotificationBell'
import css from './shell.module.css'
import { ThemeToggle } from './ThemeToggle'
import { UpgradeDialog } from './UpgradeDialog'

type Props = { user: User; onUserChange: (user: User) => void; onSignedOut: () => void }

/**
 * Signed-in frame: header with board switcher and account controls, then a board or the start
 * screen. `/?open=first` (a new guest or a just-verified account) opens the first board.
 */
export function AppShell({ user, onUserChange, onSignedOut }: Props) {
  const { params } = useLocation()
  const { t } = useI18n()
  const toast = useToast()
  const [list, setList] = useState<BoardSummary[] | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState<{ workspaceId: number | null } | null>(null)
  const [creatingWorkspace, setCreatingWorkspace] = useState(false)
  const [upgrading, setUpgrading] = useState(false)

  useEffect(() => {
    boards.list().then(setList, (e) => setError(e.message))
    workspaceApi.list().then(setWorkspaces, () => setWorkspaces([]))
  }, [])

  const opening = params.get('open') === 'first' ? firstBoard(list ?? [])?.id : undefined
  const selectedId = Number(params.get('board')) || opening
  const select = (id: number) => navigate(`/?board=${id}`)

  function updated(id: number, changes: Partial<BoardSummary>) {
    setList((current) => current?.map((b) => (b.id === id ? { ...b, ...changes } : b)) ?? null)
  }

  function deleted(id: number) {
    setList((list ?? []).filter((b) => b.id !== id))
    navigate('/', { replace: true })
  }

  function created(board: BoardSummary) {
    setList((current) => [...(current ?? []), board])
    select(board.id)
  }

  function workspaceCreated(workspace: Workspace, made: BoardSummary[]) {
    setWorkspaces((current) => [...current, workspace])
    setList((current) => [...(current ?? []), ...made])
    toast({ message: t('workspace.created', { name: workspace.name }) })
    navigate('/')
  }

  return (
    <div className={css.shell}>
      <header className={css.header}>
        <span className={css.logo}>
          <Logo collapsible />
        </span>
        <button
          type="button"
          className={`${ui.iconButton} ${css.allBoards}`}
          aria-label={t('shell.allBoards')}
          title={t('shell.allBoards')}
          aria-current={selectedId ? undefined : 'page'}
          onClick={() => navigate('/')}
        >
          <LayoutGrid size={18} aria-hidden="true" />
        </button>
        <BoardSwitcher boards={list ?? []} workspaces={workspaces} selectedId={selectedId} onSelect={select} />
        <div className={css.spacer} />
        <button
          type="button"
          className={`${ui.button} ${ui.primary} ${css.newBoard}`}
          aria-label={t('shell.newBoard')}
          onClick={() => setCreating({ workspaceId: null })}
        >
          <Plus size={16} aria-hidden="true" />
          <span>{t('shell.newBoard')}</span>
        </button>
        <NotificationBell />
        <LanguageButton onChange={(lang) => auth.setLanguage(lang).then(onUserChange)} />
        <ThemeToggle />
        <AccountMenu
          user={user}
          onUserChange={onUserChange}
          onSignedOut={onSignedOut}
          onUpgrade={() => setUpgrading(true)}
        />
      </header>

      {user.is_guest ? (
        <div className={css.guestBar}>
          <span className={css.guestText}>{t('shell.guestBar')}</span>
          <button type="button" className={ui.linkButton} onClick={() => setUpgrading(true)}>
            {t('shell.saveBoards')}
          </button>
        </div>
      ) : null}

      <main className={css.main}>
        {error ? (
          <p className={ui.alert} role="alert">
            {error}
          </p>
        ) : selectedId ? (
          <BoardView
            key={selectedId}
            boardId={selectedId}
            userId={user.id}
            isGuest={user.is_guest}
            starred={list?.find((b) => b.id === selectedId)?.starred ?? false}
            workspaces={workspaces}
            onRenamed={(id, title) => updated(id, { title })}
            onDeleted={deleted}
            onUpdated={updated}
            onCreated={created}
          />
        ) : list ? (
          <StartScreen
            boards={list}
            workspaces={workspaces}
            onNewWorkspace={() => setCreatingWorkspace(true)}
            onNewBoard={(workspaceId) => setCreating({ workspaceId: workspaceId ?? null })}
            onWorkspacesChange={setWorkspaces}
            onBoardCreated={created}
            onBoardDeleted={(id) => setList((current) => current?.filter((b) => b.id !== id) ?? null)}
            onWorkspaceDeleted={(id) =>
              setList((current) => current?.map((b) => (b.workspace_id === id ? { ...b, workspace_id: null } : b)) ?? null)
            }
          />
        ) : null}
      </main>

      <NewBoardDialog
        open={creating !== null}
        onClose={() => setCreating(null)}
        onCreated={created}
        workspaces={workspaces}
        workspaceId={creating?.workspaceId ?? null}
      />
      <NewWorkspaceDialog open={creatingWorkspace} onClose={() => setCreatingWorkspace(false)} onCreated={workspaceCreated} />
      <UpgradeDialog open={upgrading} onClose={() => setUpgrading(false)} />
    </div>
  )
}
