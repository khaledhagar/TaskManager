import { useState } from 'react'
import ui from '../ui/ui.module.css'
import css from './board.module.css'

/** Add cards one after another: Enter adds and keeps the field open, Escape closes. */
export function CardComposer({ onAdd, onClose }: { onAdd: (title: string) => void; onClose: () => void }) {
  const [title, setTitle] = useState('')

  function add() {
    const next = title.trim()
    if (!next) return
    onAdd(next)
    setTitle('')
  }

  return (
    <div className={css.composer}>
      <textarea
        aria-label="New card title"
        className={`${ui.input} ${css.composerInput}`}
        placeholder="What needs doing?"
        rows={2}
        maxLength={200}
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value.replace(/\n/g, ''))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add()
          }
          if (e.key === 'Escape') onClose()
        }}
      />
      <div className={css.inline}>
        <button type="button" className={`${ui.button} ${ui.primary}`} onClick={add}>
          Add card
        </button>
        <button type="button" className={`${ui.button} ${ui.ghost}`} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}
