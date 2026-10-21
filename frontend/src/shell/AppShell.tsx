import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { auth, type User } from '../api/auth'
import { boards, type BoardSummary } from '../api/boards'
import { BoardView } from '../board/BoardView'
import { useI18n } from '../i18n/context'
import { LanguageButton } from '../i18n/I18n'
import { navigate, useLocation } from '../lib/router'
import { Logo } from '../ui/Logo'
import ui from '../ui/ui.module.css'
import { AccountMenu } from './AccountMenu'
import { BoardSwitcher } from './BoardSwitcher'
import { NewBoardDialog } from './NewBoardDialog'
import css from './shell.module.css'
import { ThemeToggle } from './ThemeToggle'
import { UpgradeDialog } from './UpgradeDialog'

type Props = { user: User; onUserChange: (user: User) => void; onSignedOut: () => void }

/** Signed-in frame: header with board switcher and account controls, then the board. */
export function AppShell({ user, onUserChange, onSignedOut }: Props) {
  const { params } = useLocation()
  const { t } = useI18n()
  const [list, setList] = useState<BoardSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [upgrading, setUpgrading] = useState(false)

  useEffect(() => {
    boards.list().then(setList, (e) => setError(e.message))
  }, [])

  const selectedId = Number(params.get('board')) || list?.[0]?.id
  const select = (id: number) => navigate(`/?board=${id}`)

  function renamed(id: number, title: string) {
    setList((current) => current?.map((b) => (b.id === id ? { ...b, title } : b)) ?? null)
  }

  function deleted(id: number) {
    const rest = (list ?? []).filter((b) => b.id !== id)
    setList(rest)
    navigate(rest.length ? `/?board=${rest[0].id}` : '/', { replace: true })
  }

  function created(board: BoardSummary) {
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
          aria-label={t('shell.newBoard')}
          onClick={() => setCreating(true)}
        >
          <Plus size={16} aria-hidden="true" />
          <span>{t('shell.newBoard')}</span>
        </button>
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
            onRenamed={renamed}
            onDeleted={deleted}
          />
        ) : list?.length === 0 ? (
          <div className={css.empty}>
            <h1>{t('shell.noBoards')}</h1>
            <p>{t('shell.noBoardsHint')}</p>
            <button
              type="button"
              className={`${ui.button} ${ui.primary}`}
              onClick={() => setCreating(true)}
            >
              {t('shell.newBoard')}
            </button>
          </div>
        ) : null}
      </main>

      <NewBoardDialog open={creating} onClose={() => setCreating(false)} onCreated={created} />
      <UpgradeDialog open={upgrading} onClose={() => setUpgrading(false)} />
    </div>
  )
}
