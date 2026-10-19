import { X } from 'lucide-react'
import { useState } from 'react'
import type { Card, Label, LabelColor } from '../api/boards'
import ui from '../ui/ui.module.css'
import css from './board.module.css'
import { LABEL_COLORS, LABEL_SWATCH } from './display'
import type { BoardActions } from './useBoard'

type Props = { card: Card; labels: Label[]; actions: BoardActions }

/** Toggle the board's labels on a card, create new ones, or delete them from the board. */
export function LabelPicker({ card, labels, actions }: Props) {
  const [name, setName] = useState('')
  const [color, setColor] = useState<LabelColor>('blue')
  const [confirmId, setConfirmId] = useState<number | null>(null)

  const toggle = (id: number) =>
    actions.setCardLabels(
      card.id,
      card.label_ids.includes(id) ? card.label_ids.filter((x) => x !== id) : [...card.label_ids, id],
    )

  async function create() {
    if (!name.trim()) return
    const label = await actions.addLabel(name.trim(), color)
    if (label) {
      setName('')
      actions.setCardLabels(card.id, [...card.label_ids, label.id])
    }
  }

  return (
    <fieldset className={css.labelBox}>
      <legend className={ui.label}>Labels</legend>
      <ul className={css.labelList}>
        {labels.map((l) =>
          confirmId === l.id ? (
            <li key={l.id} className={css.labelConfirm} role="alert">
              <span>Remove "{l.name}" from all cards on this board?</span>
              <span className={css.inline}>
                <button
                  type="button"
                  className={`${ui.button} ${ui.danger}`}
                  onClick={() => {
                    setConfirmId(null)
                    actions.deleteLabel(l.id)
                  }}
                >
                  Remove label
                </button>
                <button type="button" className={`${ui.button} ${ui.ghost}`} onClick={() => setConfirmId(null)}>
                  Keep
                </button>
              </span>
            </li>
          ) : (
          <li key={l.id} className={css.labelRow}>
            <label className={css.labelToggle}>
              <input type="checkbox" checked={card.label_ids.includes(l.id)} onChange={() => toggle(l.id)} />
              <span className={css.swatch} style={{ background: LABEL_SWATCH[l.color] }} />
              {l.name}
            </label>
            <button
              type="button"
              className={css.itemDelete}
              aria-label={`Delete label ${l.name} from this board`}
              onClick={() => setConfirmId(l.id)}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </li>
          ),
        )}
      </ul>
      <input
        aria-label="New label name"
        className={ui.input}
        placeholder="New label"
        maxLength={40}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && create()}
      />
      <div className={css.swatches} role="radiogroup" aria-label="Label color">
        {LABEL_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={color === c}
            aria-label={c}
            className={css.swatchPick}
            style={{ background: LABEL_SWATCH[c] }}
            onClick={() => setColor(c)}
          />
        ))}
      </div>
      <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={create} disabled={!name.trim()}>
        Add label
      </button>
    </fieldset>
  )
}
