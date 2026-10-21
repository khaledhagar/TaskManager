import { useCallback, useEffect, useState } from 'react'
import type { Role } from '../api/boards'
import { sharing, type InviteLink, type Members } from '../api/sharing'
import { useI18n } from '../i18n/context'
import { Dialog } from '../ui/Dialog'
import ui from '../ui/ui.module.css'
import { InviteForm } from './InviteForm'
import { MemberRow } from './MemberRow'
import { AccessRequests, PendingInvites } from './PendingLists'
import { ShareLink } from './ShareLink'
import css from './sharing.module.css'

type Props = {
  open: boolean
  onClose: () => void
  board: { id: number; title: string }
  userId: number
  isGuest: boolean
  onLeft: () => void
}

/** Who is on the board. The admin invites, sets each member's permission and answers requests. */
export function MembersPanel({ open, onClose, board, userId, isGuest, onLeft }: Props) {
  const { t } = useI18n()
  return (
    <Dialog open={open} onClose={onClose} title={t('members.title', { title: board.title })} wide>
      <PanelBody board={board} userId={userId} isGuest={isGuest} onLeft={onLeft} />
    </Dialog>
  )
}

function PanelBody({ board, userId, isGuest, onLeft }: Omit<Props, 'open' | 'onClose'>) {
  const { t } = useI18n()
  const [data, setData] = useState<Members | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shared, setShared] = useState<{ invite: InviteLink; again: boolean } | null>(null)
  const [leaving, setLeaving] = useState(false)

  const load = useCallback(() => sharing.members(board.id).then(setData, (e) => setError(e.message)), [board.id])
  useEffect(() => {
    load()
  }, [load])

  /** Run a change, show its error if any, then reload the lists. */
  async function run(change: () => Promise<unknown>) {
    setError(null)
    try {
      await change()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    await load()
  }

  if (!data)
    return error ? (
      <p className={ui.alert} role="alert">
        {error}
      </p>
    ) : (
      <div className={css.loading} role="status" aria-label={t('app.loading')} />
    )

  const admin = data.role === 'admin'
  const canAsk = data.role === 'viewer' || data.role === 'updater'

  return (
    <div className={css.panel}>
      {error ? (
        <p className={ui.alert} role="alert">
          {error}
        </p>
      ) : null}
      {admin && isGuest ? <p className={ui.notice}>{t('members.guest')}</p> : null}
      {admin && !isGuest ? (
        <InviteForm
          boardId={board.id}
          onInvited={(invite) => {
            setShared({ invite, again: false })
            load()
          }}
        />
      ) : null}
      {shared ? (
        <ShareLink
          link={shared.invite.link}
          boardTitle={board.title}
          note={t(shared.again ? 'share.newLink' : 'share.sentTo', { email: shared.invite.email })}
        />
      ) : null}
      {admin ? null : <p>{t('members.yourRole', { role: t(`role.${data.role}`) })}</p>}
      <ul className={css.list} aria-label={t('board.members')}>
        {data.members.map((member) => (
          <MemberRow
            key={member.user_id}
            member={member}
            isYou={member.user_id === userId}
            manage={admin}
            onRole={(role: Role) => {
              // Show the choice at once; the reload after saving puts it back if the server refuses.
              setData({ ...data, members: data.members.map((m) => (m.user_id === member.user_id ? { ...m, role } : m)) })
              run(() => sharing.changeRole(board.id, member.user_id, role))
            }}
            onRemove={() => run(() => sharing.remove(board.id, member.user_id))}
          />
        ))}
      </ul>
      {admin ? (
        <>
          <AccessRequests
            requests={data.requests}
            onApprove={(request, role) => run(() => sharing.approve(request.id, role))}
            onDecline={(request) => run(() => sharing.decline(request.id))}
          />
          <PendingInvites
            invites={data.invites}
            onResend={(invite) =>
              run(async () => setShared({ invite: await sharing.resend(invite.id), again: true }))
            }
            onCancel={(invite) => run(() => sharing.cancel(invite.id))}
          />
        </>
      ) : (
        <div className={css.memberActions}>
          {canAsk ? (
            <button
              type="button"
              className={`${ui.button} ${ui.primary}`}
              disabled={data.requested}
              onClick={() => run(() => sharing.requestAccess(board.id))}
            >
              {data.requested ? t('access.requested') : t('access.request')}
            </button>
          ) : null}
          {leaving ? (
            <div className={css.confirm}>
              <span>{t('members.leaveConfirm')}</span>
              <button
                type="button"
                className={`${ui.button} ${ui.danger}`}
                onClick={() => sharing.remove(board.id, userId).then(onLeft, (e) => setError(e.message))}
              >
                {t('members.leave')}
              </button>
              <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={() => setLeaving(false)}>
                {t('ui.cancel')}
              </button>
            </div>
          ) : (
            <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={() => setLeaving(true)}>
              {t('members.leave')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
