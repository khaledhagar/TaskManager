import { Archive, Check, Copy, Timer, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import type { Board, Card, Label, Priority, Role } from '../api/boards'
import { ActivityList } from '../collab/ActivityList'
import { CommentsSection } from '../collab/CommentsSection'
import { AttachmentsSection } from '../files/AttachmentsSection'
import { useI18n } from '../i18n/context'
import { Dialog } from '../ui/Dialog'
import ui from '../ui/ui.module.css'
import { MicButton } from '../voice/MicButton'
import voice from '../voice/voice.module.css'
import css from './cardWindow.module.css'
import { AssigneePicker } from './AssigneePicker'
import { ChecklistEditor } from './ChecklistEditor'
import { DescriptionEditor } from './DescriptionEditor'
import { PRIORITIES, priorityLabel } from './display'
import { LabelPicker } from './LabelPicker'
import type { BoardActions } from './useBoard'

type Props = {
  card: Card
  labels: Label[]
  members: Board['members']
  actions: BoardActions
  onClose: () => void
  boardId: number
  role: Role
  userId: number
}

/** Card details: content first, properties at the end side. Every change saves at once. */
export function CardModal({ card, labels, members, actions, onClose, boardId, role, userId }: Props) {
  const myEmail = members.find((m) => m.user_id === userId)?.email ?? null
  const { t } = useI18n()
  const update = (changes: Parameters<BoardActions['updateCard']>[1]) =>
    actions.updateCard(card.id, changes)

  return (
    <Dialog open onClose={onClose} title={card.title} hideTitle wide>
      <div className={css.modal}>
        <div className={css.modalMain}>
          <TitleEditor title={card.title} onSave={(title) => update({ title })} />
          <DescriptionEditor details={card.details} onSave={(details) => update({ details })} />
          <ChecklistEditor card={card} actions={actions} />
          <AttachmentsSection card={card} actions={actions} />
          <CommentsSection
            cardId={card.id}
            members={members}
            role={role}
            userId={userId}
            onCountChange={(count) => actions.setCommentCount(card.id, count)}
          />
          <section className={css.section}>
            <h3 className={css.sectionTitle}>{t('history.title')}</h3>
            {/* Reloads when the card changes, so the newest change shows. */}
            <ActivityList boardId={boardId} cardId={card.id} myEmail={myEmail} pageSize={10} reload={card} />
          </section>
        </div>
        <aside className={css.modalSide}>
          <button
            type="button"
            className={`${ui.button} ${card.completed ? css.completeOn : ui.secondary}`}
            aria-pressed={card.completed}
            onClick={() => update({ completed: !card.completed })}
          >
            <Check size={16} aria-hidden="true" />
            {t(card.completed ? 'card.completed' : 'card.markComplete')}
          </button>

          <div className={ui.field}>
            <label className={ui.label} htmlFor="card-priority">
              {t('card.priority')}
            </label>
            <select
              id="card-priority"
              className={ui.input}
              value={card.priority}
              onChange={(e) => update({ priority: e.target.value as Priority })}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {priorityLabel(p)}
                </option>
              ))}
            </select>
          </div>

          <div className={ui.field}>
            <label className={ui.label} htmlFor="card-due">
              {t('card.dueDate')}
            </label>
            <div className={css.inline}>
              <input
                id="card-due"
                type="date"
                className={ui.input}
                value={card.due_date ?? ''}
                onChange={(e) => e.target.value && update({ due_date: e.target.value })}
              />
              {card.due_date ? (
                <button
                  type="button"
                  className={`${ui.button} ${ui.ghost}`}
                  aria-label={t('card.clearDue')}
                  onClick={() => update({ due_date: null })}
                >
                  {t('card.clear')}
                </button>
              ) : null}
            </div>
          </div>

          <LabelPicker card={card} labels={labels} actions={actions} />

          <AssigneePicker card={card} members={members} actions={actions} />

          {card.focus_count ? (
            <p className={`${ui.hint} ${css.inline}`}>
              <Timer size={14} aria-hidden="true" />
              {t('focus.stats', { count: card.focus_count, minutes: card.focus_minutes ?? 0 })}
            </p>
          ) : null}

          <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={() => actions.duplicateCard(card.id)}>
            <Copy size={16} aria-hidden="true" />
            {t('card.duplicate')}
          </button>
          <button
            type="button"
            className={`${ui.button} ${ui.secondary}`}
            onClick={() => {
              actions.archiveCard(card.id)
              onClose()
            }}
          >
            <Archive size={16} aria-hidden="true" />
            {t('card.archive')}
          </button>

          <button
            type="button"
            className={`${ui.button} ${ui.ghost} ${css.deleteCard}`}
            onClick={() => {
              actions.deleteCard(card.id)
              onClose()
            }}
          >
            <Trash2 size={16} aria-hidden="true" />
            {t('card.delete')}
          </button>
        </aside>
      </div>
    </Dialog>
  )
}

function TitleEditor({ title, onSave }: { title: string; onSave: (title: string) => void }) {
  const { t } = useI18n()
  const [value, setValue] = useState(title)
  const input = useRef<HTMLTextAreaElement>(null)
  function commit() {
    const next = value.trim()
    if (next && next !== title) onSave(next)
    else setValue(title)
  }
  return (
    <div className={voice.withMic}>
    <textarea
      ref={input}
      aria-label={t('card.title')}
      dir="auto"
      className={css.titleInput}
      rows={1}
      maxLength={200}
      value={value}
      onChange={(e) => setValue(e.target.value.replace(/\n/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
        }
      }}
    />
    {/* After speaking, focus returns to the title: Enter or leaving the field saves it. */}
    <MicButton value={value} onChange={setValue} maxLength={200} onEnd={() => input.current?.focus()} />
    </div>
  )
}
