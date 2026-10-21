import { useEffect, useState } from 'react'
import type { Role } from '../api/boards'
import { workspaces, type BoardMembers } from '../api/workspaces'
import { useI18n } from '../i18n/context'
import { Dialog } from '../ui/Dialog'
import ui from '../ui/ui.module.css'
import css from './panel.module.css'

type Target = { id: number | 'none'; name: string } | null

/** Everyone on a workspace's boards (or on your boards without one), board by board. */
export function MembersDialog({ target, onClose }: { target: Target; onClose: () => void }) {
  const { t } = useI18n()
  return (
    <Dialog open={target !== null} onClose={onClose} title={t('start.membersTitle', { name: target?.name ?? '' })}>
      {target ? <MembersList key={String(target.id)} id={target.id} /> : null}
    </Dialog>
  )
}

function MembersList({ id }: { id: number | 'none' }) {
  const { t } = useI18n()
  const [boards, setBoards] = useState<BoardMembers[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    workspaces.members(id).then(setBoards, (e: Error) => setError(e.message))
  }, [id])

  if (error)
    return (
      <p className={ui.alert} role="alert">
        {error}
      </p>
    )
  if (!boards) return null
  if (!boards.length) return <p className={ui.hint}>{t('start.noBoardsHere')}</p>
  return (
    <div className={css.membersBoards}>
      {boards.map((b) => (
        <section key={b.board_id} aria-label={b.title}>
          <h3 className={css.membersBoard} dir="auto">
            {b.title}
          </h3>
          <ul className={css.membersList}>
            {b.members.map((m) => (
              <li key={m.email ?? m.role} className={css.memberRow}>
                <span className={css.memberAvatar} aria-hidden="true">
                  {(m.email ?? t('account.guest')).slice(0, 1).toUpperCase()}
                </span>
                <span className={css.memberEmail}>{m.email ?? t('account.guest')}</span>
                <span className={ui.hint}>{t(`role.${m.role as Role}`)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
