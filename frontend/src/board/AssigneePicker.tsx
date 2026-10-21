import type { Board, Card } from '../api/boards'
import { useI18n } from '../i18n/context'
import ui from '../ui/ui.module.css'
import css from './assignees.module.css'
import type { BoardActions } from './useBoard'

type Props = { card: Card; members: Board['members']; actions: BoardActions }

/** Tick the members this card is assigned to; each change saves at once. */
export function AssigneePicker({ card, members, actions }: Props) {
  const { t } = useI18n()
  const toggle = (userId: number) =>
    actions.setAssignees(
      card.id,
      card.assignee_ids.includes(userId)
        ? card.assignee_ids.filter((id) => id !== userId)
        : [...card.assignee_ids, userId],
    )

  return (
    <fieldset className={css.assigneeBox}>
      <legend className={ui.label}>{t('card.assignees')}</legend>
      {members.length < 2 ? <p className={ui.hint}>{t('card.noMembers')}</p> : null}
      {members.map((m) => (
        <label key={m.user_id} className={css.assigneeOption}>
          <input type="checkbox" checked={card.assignee_ids.includes(m.user_id)} onChange={() => toggle(m.user_id)} />
          <span className={css.assigneeAvatar} aria-hidden="true">
            {(m.email ?? t('members.youName')).slice(0, 1).toUpperCase()}
          </span>
          {/* Only a guest has no email, and a guest is alone on their own board. */}
          <span className={css.assigneeEmail} dir="ltr" title={m.email ?? ''}>
            {m.email ?? t('members.youName')}
          </span>
        </label>
      ))}
    </fieldset>
  )
}
