import { Check, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { Card, Label, Priority } from '../api/boards'
import { AttachmentsSection } from '../files/AttachmentsSection'
import { Dialog } from '../ui/Dialog'
import ui from '../ui/ui.module.css'
import css from './board.module.css'
import { ChecklistEditor } from './ChecklistEditor'
import { DescriptionEditor } from './DescriptionEditor'
import { PRIORITIES, PRIORITY_LABEL } from './display'
import { LabelPicker } from './LabelPicker'
import type { BoardActions } from './useBoard'

type Props = { card: Card; labels: Label[]; actions: BoardActions; onClose: () => void }

/** Card details: content on the left, properties on the right. Every change saves at once. */
export function CardModal({ card, labels, actions, onClose }: Props) {
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
        </div>
        <aside className={css.modalSide}>
          <button
            type="button"
            className={`${ui.button} ${card.completed ? css.completeOn : ui.secondary}`}
            aria-pressed={card.completed}
            onClick={() => update({ completed: !card.completed })}
          >
            <Check size={16} aria-hidden="true" />
            {card.completed ? 'Completed' : 'Mark complete'}
          </button>

          <div className={ui.field}>
            <label className={ui.label} htmlFor="card-priority">
              Priority
            </label>
            <select
              id="card-priority"
              className={ui.input}
              value={card.priority}
              onChange={(e) => update({ priority: e.target.value as Priority })}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </div>

          <div className={ui.field}>
            <label className={ui.label} htmlFor="card-due">
              Due date
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
                  aria-label="Clear due date"
                  onClick={() => update({ due_date: null })}
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          <LabelPicker card={card} labels={labels} actions={actions} />

          <button
            type="button"
            className={`${ui.button} ${ui.ghost} ${css.deleteCard}`}
            onClick={() => {
              actions.deleteCard(card.id)
              onClose()
            }}
          >
            <Trash2 size={16} aria-hidden="true" />
            Delete card
          </button>
        </aside>
      </div>
    </Dialog>
  )
}

function TitleEditor({ title, onSave }: { title: string; onSave: (title: string) => void }) {
  const [value, setValue] = useState(title)
  function commit() {
    const next = value.trim()
    if (next && next !== title) onSave(next)
    else setValue(title)
  }
  return (
    <textarea
      aria-label="Title"
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
  )
}
