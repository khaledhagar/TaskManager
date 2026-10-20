import { AlignLeft, CalendarDays, Check, ListChecks, Paperclip } from 'lucide-react'
import type { ButtonHTMLAttributes, Ref } from 'react'
import type { Card, Label } from '../api/boards'
import { useI18n } from '../i18n/context'
import css from './board.module.css'
import { LABEL_SWATCH, priorityLabel } from './display'
import { dueLabel, dueStatus } from './logic'

type Props = {
  card: Card
  labels: Label[]
  onOpen: () => void
  onToggle: () => void
  activatorRef?: Ref<HTMLButtonElement>
  activatorProps?: ButtonHTMLAttributes<HTMLButtonElement>
}

/** Card tile: completion toggle, title and a compact row of details. */
export function CardItem({ card, labels, onOpen, onToggle, activatorRef, activatorProps }: Props) {
  const { t } = useI18n()
  const status = dueStatus(card.due_date, card.completed)
  const cardLabels = labels.filter((l) => card.label_ids.includes(l.id))
  const done = card.checklist.filter((i) => i.done).length

  return (
    <div className={css.card} data-completed={card.completed || undefined}>
      <button
        type="button"
        role="checkbox"
        aria-checked={card.completed}
        aria-label={t('card.completedToggle', { title: card.title })}
        className={css.check}
        onClick={onToggle}
      >
        {card.completed ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : null}
      </button>
      <button
        type="button"
        ref={activatorRef}
        className={css.cardBody}
        onClick={onOpen}
        {...activatorProps}
      >
        <span className={css.cardTitle} dir="auto">
          {card.title}
        </span>
        <span className={css.meta}>
          <span className={css.priority} data-priority={card.priority}>
            <span className="visually-hidden">{t('card.priority')} </span>
            {priorityLabel(card.priority)}
          </span>
          {cardLabels.map((l) => (
            <span key={l.id} className={css.label} dir="auto">
              <span className={css.swatch} style={{ background: LABEL_SWATCH[l.color] }} />
              {l.name}
            </span>
          ))}
          {card.due_date ? (
            <span className={css.due} data-status={status}>
              <CalendarDays size={12} aria-hidden="true" />
              <span className="visually-hidden">{t(status === 'overdue' ? 'card.overdueDue' : 'card.due')} </span>
              {dueLabel(card.due_date)}
            </span>
          ) : null}
          {card.checklist.length ? (
            <span className={css.metaItem} data-complete={done === card.checklist.length || undefined}>
              <ListChecks size={12} className="flip-rtl" aria-hidden="true" />
              <span className="visually-hidden">{t('card.checklist')} </span>
              {done}/{card.checklist.length}
            </span>
          ) : null}
          {card.attachments.length ? (
            <span className={css.metaItem}>
              <Paperclip size={12} aria-hidden="true" />
              <span className="visually-hidden">{t('card.attachments')} </span>
              {card.attachments.length}
            </span>
          ) : null}
          {card.details.trim() ? (
            <span className={css.metaItem} title={t('card.hasDescription')}>
              <AlignLeft size={12} className="flip-rtl" aria-hidden="true" />
              <span className="visually-hidden">{t('card.hasDescription')}</span>
            </span>
          ) : null}
        </span>
      </button>
    </div>
  )
}
