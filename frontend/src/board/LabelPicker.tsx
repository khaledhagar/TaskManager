import { X } from 'lucide-react'
import { useState } from 'react'
import type { Card, Label, LabelColor } from '../api/boards'
import { useI18n } from '../i18n/context'
import ui from '../ui/ui.module.css'
import css from './board.module.css'
import { LABEL_COLORS, LABEL_SWATCH } from './display'
import type { BoardActions } from './useBoard'

type Props = { card: Card; labels: Label[]; actions: BoardActions }

/** Toggle the board's labels on a card, create new ones, or delete them from the board. */
export function LabelPicker({ card, labels, actions }: Props) {
  const { t } = useI18n()
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
      <legend className={ui.label}>{t('labels.title')}</legend>
      <ul className={css.labelList}>
        {labels.map((l) =>
          confirmId === l.id ? (
            <li key={l.id} className={css.labelConfirm} role="alert">
              <span>{t('labels.removeConfirm', { name: l.name })}</span>
              <span className={css.inline}>
                <button
                  type="button"
                  className={`${ui.button} ${ui.danger}`}
                  onClick={() => {
                    setConfirmId(null)
                    actions.deleteLabel(l.id)
                  }}
                >
                  {t('labels.remove')}
                </button>
                <button type="button" className={`${ui.button} ${ui.ghost}`} onClick={() => setConfirmId(null)}>
                  {t('ui.keep')}
                </button>
              </span>
            </li>
          ) : (
          <li key={l.id} className={css.labelRow}>
            <label className={css.labelToggle}>
              <input type="checkbox" checked={card.label_ids.includes(l.id)} onChange={() => toggle(l.id)} />
              <span className={css.swatch} style={{ background: LABEL_SWATCH[l.color] }} />
              <span dir="auto">{l.name}</span>
            </label>
            <button
              type="button"
              className={css.itemDelete}
              aria-label={t('labels.delete', { name: l.name })}
              onClick={() => setConfirmId(l.id)}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </li>
          ),
        )}
      </ul>
      <input
        aria-label={t('labels.newName')}
        dir="auto"
        className={ui.input}
        placeholder={t('labels.newPlaceholder')}
        maxLength={40}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && create()}
      />
      <div className={css.swatches} role="radiogroup" aria-label={t('labels.color')}>
        {LABEL_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={color === c}
            aria-label={t(`color.${c}`)}
            className={css.swatchPick}
            style={{ background: LABEL_SWATCH[c] }}
            onClick={() => setColor(c)}
          />
        ))}
      </div>
      <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={create} disabled={!name.trim()}>
        {t('labels.add')}
      </button>
    </fieldset>
  )
}
