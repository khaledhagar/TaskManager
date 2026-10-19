import { X } from 'lucide-react'
import { useState } from 'react'
import type { Card } from '../api/boards'
import ui from '../ui/ui.module.css'
import css from './board.module.css'
import type { BoardActions } from './useBoard'

/** Checklist with progress; items can be ticked, renamed in place, deleted and added. */
export function ChecklistEditor({ card, actions }: { card: Card; actions: BoardActions }) {
  const [draft, setDraft] = useState('')
  const done = card.checklist.filter((i) => i.done).length
  const total = card.checklist.length

  async function add() {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    await actions.addItem(card.id, text)
  }

  return (
    <section className={css.section}>
      <div className={css.sectionHead}>
        <h3 className={css.sectionTitle}>Checklist</h3>
        {total ? <span className={ui.hint}>{`${done} of ${total} done`}</span> : null}
      </div>
      {total ? (
        <div className={css.bar} aria-hidden="true">
          <span style={{ width: `${(done / total) * 100}%` }} />
        </div>
      ) : null}
      <ul className={css.items}>
        {card.checklist.map((item) => (
          <li key={item.id} className={css.item} data-done={item.done || undefined}>
            <input
              type="checkbox"
              aria-label={item.text}
              checked={item.done}
              onChange={() => actions.updateItem(card.id, item.id, { done: !item.done })}
            />
            <ItemText
              text={item.text}
              onSave={(text) => actions.updateItem(card.id, item.id, { text })}
            />
            <button
              type="button"
              className={css.itemDelete}
              aria-label={`Delete item: ${item.text}`}
              onClick={() => actions.deleteItem(card.id, item.id)}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <input
        aria-label="Add an item"
        className={ui.input}
        placeholder="Add an item and press Enter"
        maxLength={300}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && add()}
      />
    </section>
  )
}

function ItemText({ text, onSave }: { text: string; onSave: (text: string) => void }) {
  const [value, setValue] = useState(text)
  return (
    <input
      aria-label={`Edit item: ${text}`}
      className={css.itemText}
      maxLength={300}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        const next = value.trim()
        if (next && next !== text) onSave(next)
        else setValue(text)
      }}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  )
}
