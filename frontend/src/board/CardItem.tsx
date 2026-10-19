import { AlignLeft, CalendarDays, Check, ListChecks } from 'lucide-react'
import type { ButtonHTMLAttributes, Ref } from 'react'
import type { Card, Label } from '../api/boards'
import css from './board.module.css'
import { LABEL_SWATCH, PRIORITY_LABEL } from './display'
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
  const status = dueStatus(card.due_date, card.completed)
  const cardLabels = labels.filter((l) => card.label_ids.includes(l.id))
  const done = card.checklist.filter((i) => i.done).length

  return (
    <div className={css.card} data-completed={card.completed || undefined}>
      <button
        type="button"
        role="checkbox"
        aria-checked={card.completed}
        aria-label={`Completed: ${card.title}`}
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
        <span className={css.cardTitle}>{card.title}</span>
        <span className={css.meta}>
          <span className={css.priority} data-priority={card.priority}>
            <span className="visually-hidden">Priority </span>
            {PRIORITY_LABEL[card.priority]}
          </span>
          {cardLabels.map((l) => (
            <span key={l.id} className={css.label}>
              <span className={css.swatch} style={{ background: LABEL_SWATCH[l.color] }} />
              {l.name}
            </span>
          ))}
          {card.due_date ? (
            <span className={css.due} data-status={status}>
              <CalendarDays size={12} aria-hidden="true" />
              <span className="visually-hidden">{status === 'overdue' ? 'Overdue, due ' : 'Due '}</span>
              {dueLabel(card.due_date)}
            </span>
          ) : null}
          {card.checklist.length ? (
            <span className={css.metaItem} data-complete={done === card.checklist.length || undefined}>
              <ListChecks size={12} aria-hidden="true" />
              <span className="visually-hidden">Checklist </span>
              {done}/{card.checklist.length}
            </span>
          ) : null}
          {card.details.trim() ? (
            <span className={css.metaItem} title="Has a description">
              <AlignLeft size={12} aria-hidden="true" />
              <span className="visually-hidden">Has a description</span>
            </span>
          ) : null}
        </span>
      </button>
    </div>
  )
}
