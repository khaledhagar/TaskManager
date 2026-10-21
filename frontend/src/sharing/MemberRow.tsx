import { useState } from 'react'
import type { Role } from '../api/boards'
import type { Member } from '../api/sharing'
import { useI18n } from '../i18n/context'
import ui from '../ui/ui.module.css'
import css from './sharing.module.css'

const CHOICES = ['viewer', 'updater', 'editor'] as const
const HINTS = { viewer: 'role.viewerHint', updater: 'role.updaterHint', editor: 'role.editorHint' } as const

type Props = {
  member: Member
  isYou: boolean
  manage: boolean
  onRole: (role: Role) => void
  onRemove: () => void
}

/** One member: email, and for the admin a single-choice permission and Remove. */
export function MemberRow({ member, isYou, manage, onRole, onRemove }: Props) {
  const { t } = useI18n()
  const [confirming, setConfirming] = useState(false)
  const email = member.email ?? ''
  const fixed = member.role === 'admin' || !manage

  return (
    <li className={css.member}>
      <div className={css.who}>
        <span className={css.avatar} aria-hidden="true">
          {email.slice(0, 1).toUpperCase()}
        </span>
        <span className={css.email} dir="ltr" title={email}>
          {email}
        </span>
        {isYou ? <span className={ui.hint}>{t('members.you')}</span> : null}
      </div>
      {fixed ? (
        <span className={css.roleBadge}>{t(`role.${member.role}`)}</span>
      ) : (
        <fieldset className={css.roles}>
          <legend className="visually-hidden">{t('members.permission', { email })}</legend>
          {CHOICES.map((role) => (
            <label key={role} className={css.roleOption} title={t(HINTS[role])}>
              <input
                type="radio"
                name={`role-${member.user_id}`}
                checked={member.role === role}
                onChange={() => onRole(role)}
              />
              <span>{t(`role.${role}`)}</span>
            </label>
          ))}
        </fieldset>
      )}
      {manage && member.role !== 'admin' ? (
        confirming ? (
          <div className={css.confirm}>
            <span>{t('members.removeConfirm', { email })}</span>
            <button type="button" className={`${ui.button} ${ui.danger}`} onClick={onRemove}>
              {t('members.remove')}
            </button>
            <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={() => setConfirming(false)}>
              {t('ui.cancel')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={ui.linkButton}
            aria-label={t('members.removeLabel', { email })}
            onClick={() => setConfirming(true)}
          >
            {t('members.remove')}
          </button>
        )
      ) : null}
    </li>
  )
}
