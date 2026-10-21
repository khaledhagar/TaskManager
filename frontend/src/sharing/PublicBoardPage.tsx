import { useEffect, useState } from 'react'
import type { User } from '../api/auth'
import { sharing, type PublicBoard } from '../api/sharing'
import boardCss from '../board/board.module.css'
import { CardItem } from '../board/CardItem'
import columnCss from '../board/column.module.css'
import { Backdrop } from '../files/Backdrop'
import { useI18n } from '../i18n/context'
import { LanguageButton } from '../i18n/I18n'
import { navigate } from '../lib/router'
import shell from '../shell/shell.module.css'
import { ThemeToggle } from '../shell/ThemeToggle'
import { Link } from '../ui/Link'
import { Logo } from '../ui/Logo'
import ui from '../ui/ui.module.css'
import { rememberReturn } from './inviteStore'
import css from './sharing.module.css'

const noop = () => {}

/** /p/{token}: a public board, read-only for anyone; signed-in visitors can join as Viewer. */
export function PublicBoardPage({ token, user }: { token: string; user: User | null }) {
  const { t } = useI18n()
  const [board, setBoard] = useState<PublicBoard | null>(null)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    sharing.publicBoard(token).then(setBoard, () => setMissing(true))
  }, [token])

  // A signed-out visitor who signs in from here comes back to join.
  useEffect(() => {
    if (!user) rememberReturn(`/p/${token}`)
  }, [user, token])

  async function join() {
    setError(null)
    try {
      navigate(`/?board=${(await sharing.joinPublic(token)).id}`, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className={shell.shell}>
      <header className={shell.header}>
        <span className={shell.logo}>
          <Logo collapsible />
        </span>
        <div className={shell.spacer} />
        <LanguageButton />
        <ThemeToggle />
      </header>
      <main className={shell.main}>
        {missing ? (
          <div className={css.publicError}>
            <p role="alert">{t('public.invalid')}</p>
            <Link to="/">{t('invite.home')}</Link>
          </div>
        ) : !board ? (
          <div className={boardCss.skeleton} role="status" aria-label={t('board.loading')} />
        ) : (
          <section className={boardCss.board} data-backdrop={board.background.kind !== 'none' || undefined}>
            <Backdrop
              boardId={0}
              background={board.background}
              src={`${sharing.publicBackground(token)}?v=${board.background.version}`}
            />
            <div className={boardCss.boardTop}>
              <div className={boardCss.boardHead}>
                <h1 className={boardCss.boardTitle} dir="auto">
                  {board.title}
                </h1>
                <span className={css.viewOnly}>{t('public.viewOnly')}</span>
                <div className={boardCss.boardActions}>
                  {user ? (
                    <button type="button" className={`${ui.button} ${ui.primary}`} onClick={join}>
                      {t('public.join')}
                    </button>
                  ) : (
                    <Link to="/signin" className={`${ui.button} ${ui.primary}`}>
                      {t('public.signIn')}
                    </Link>
                  )}
                </div>
              </div>
              {error ? (
                <p className={ui.alert} role="alert">
                  {error}
                </p>
              ) : null}
            </div>
            {/* Focusable so keyboard users can scroll the columns (nothing inside takes focus). */}
            <div className={columnCss.columns} tabIndex={0} role="region" aria-label={board.title}>
              {board.columns.map((column) => (
                <section key={column.id} className={columnCss.column} aria-label={column.title}>
                  <header className={columnCss.columnHead}>
                    <h2 className={columnCss.columnTitle} dir="auto">
                      {column.title}
                    </h2>
                    <span className={columnCss.count}>{column.cards.length}</span>
                  </header>
                  <ul className={columnCss.cards}>
                    {column.cards.map((card) => (
                      <li key={card.id} className={columnCss.cardSlot}>
                        <CardItem
                          card={{ ...card, position: 0, attachments: [], assignee_ids: [] }}
                          labels={board.labels}
                          readOnly
                          onOpen={noop}
                          onToggle={noop}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
