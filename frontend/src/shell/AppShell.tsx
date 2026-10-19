import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { User } from '../api/auth'
import { boards, type BoardSummary } from '../api/boards'
import { navigate, useLocation } from '../lib/router'
import { Logo } from '../ui/Logo'
import ui from '../ui/ui.module.css'
import { AccountMenu } from './AccountMenu'
import { BoardPreview } from './BoardPreview'
import { BoardSwitcher } from './BoardSwitcher'
import { NewBoardDialog } from './NewBoardDialog'
import css from './shell.module.css'
import { ThemeToggle } from './ThemeToggle'
import { UpgradeDialog } from './UpgradeDialog'

type Props = { user: User; onUserChange: (user: User) => void; onSignedOut: () => void }

/** Signed-in frame: header with board switcher and account controls, then the board. */
export function AppShell({ user, onUserChange, onSignedOut }: Props) {
  const { params } = useLocation()
  const [list, setList] = useState<BoardSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [upgrading, setUpgrading] = useState(false)

  useEffect(() => {
    boards.list().then(setList, (e) => setError(e.message))
  }, [])

  const selectedId = Number(params.get('board')) || list?.[0]?.id
  const select = (id: number) => navigate(`/?board=${id}`)

  async function create(title: string) {
    const board = await boards.create(title)
    setList((current) => [...(current ?? []), board])
    select(board.id)
  }

  return (
    <div className={css.shell}>
      <header className={css.header}>
        <span className={css.logo}>
          <Logo collapsible />
        </span>
        <BoardSwitcher boards={list ?? []} selectedId={selectedId} onSelect={select} />
        <div className={css.spacer} />
        <button
          type="button"
          className={`${ui.button} ${ui.primary} ${css.newBoard}`}
          onClick={() => setCreating(true)}
        >
          <Plus size={16} aria-hidden="true" />
          <span>New board</span>
        </button>
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
          <span className={css.guestText}>
            You're using a guest account. Guest boards are removed after 7 days.
          </span>
          <button type="button" className={ui.linkButton} onClick={() => setUpgrading(true)}>
            Save your boards
          </button>
        </div>
      ) : null}

      <main className={css.main}>
        {error ? (
          <p className={ui.alert} role="alert">
            {error}
          </p>
        ) : selectedId ? (
          <BoardPreview key={selectedId} boardId={selectedId} />
        ) : list?.length === 0 ? (
          <div className={css.empty}>
            <h1>No boards yet</h1>
            <p>Create a board to start planning.</p>
            <button
              type="button"
              className={`${ui.button} ${ui.primary}`}
              onClick={() => setCreating(true)}
            >
              New board
            </button>
          </div>
        ) : null}
      </main>

      <NewBoardDialog open={creating} onClose={() => setCreating(false)} onCreate={create} />
      <UpgradeDialog open={upgrading} onClose={() => setUpgrading(false)} />
    </div>
  )
}
