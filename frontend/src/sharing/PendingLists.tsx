import type { Role } from '../api/boards'
import type { AccessRequest, PendingInvite } from '../api/sharing'
import { useI18n } from '../i18n/context'
import ui from '../ui/ui.module.css'
import css from './sharing.module.css'

type InvitesProps = {
  invites: PendingInvite[]
  onResend: (invite: PendingInvite) => void
  onCancel: (invite: PendingInvite) => void
}

/** Invitations not accepted yet: send again (a fresh link to copy or share) or cancel. */
export function PendingInvites({ invites, onResend, onCancel }: InvitesProps) {
  const { t } = useI18n()
  if (!invites.length) return null
  return (
    <section className={css.section}>
      <h3 className={css.sectionTitle}>{t('members.pending')}</h3>
      <ul className={css.list}>
        {invites.map((invite) => (
          <li key={invite.id} className={css.pending}>
            <span className={css.email} dir="ltr">
              {invite.email}
            </span>
            <span className={css.pendingActions}>
              <button
                type="button"
                className={ui.linkButton}
                aria-label={t('members.sendAgainLabel', { email: invite.email })}
                onClick={() => onResend(invite)}
              >
                {t('members.sendAgain')}
              </button>
              <button
                type="button"
                className={ui.linkButton}
                aria-label={t('members.cancelInviteLabel', { email: invite.email })}
                onClick={() => onCancel(invite)}
              >
                {t('members.cancelInvite')}
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

type RequestsProps = {
  requests: AccessRequest[]
  onApprove: (request: AccessRequest, role: Role) => void
  onDecline: (request: AccessRequest) => void
}

/** Members asking for more access: allow as Can update tasks or Full access, or decline. */
export function AccessRequests({ requests, onApprove, onDecline }: RequestsProps) {
  const { t } = useI18n()
  if (!requests.length) return null
  return (
    <section className={css.section}>
      <h3 className={css.sectionTitle}>{t('members.requests')}</h3>
      <ul className={css.list}>
        {requests.map((request) => (
          <li key={request.id} className={css.request}>
            <span dir="auto">{t('members.asks', { email: request.email ?? '' })}</span>
            <span className={css.pendingActions}>
              {request.role === 'viewer' ? (
                <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={() => onApprove(request, 'updater')}>
                  {t('members.allowUpdate')}
                </button>
              ) : null}
              <button type="button" className={`${ui.button} ${ui.primary}`} onClick={() => onApprove(request, 'editor')}>
                {t('members.allowFull')}
              </button>
              <button type="button" className={ui.linkButton} onClick={() => onDecline(request)}>
                {t('members.decline')}
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
