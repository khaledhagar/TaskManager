import { useState } from 'react'
import ui from '../ui/ui.module.css'
import css from './board.module.css'
import { Markdown } from './Markdown'

/** Markdown description with Write and Preview modes; saved explicitly. */
export function DescriptionEditor({ details, onSave }: { details: string; onSave: (text: string) => void }) {
  const [mode, setMode] = useState<'write' | 'preview'>(details ? 'preview' : 'write')
  const [draft, setDraft] = useState(details)
  const dirty = draft !== details

  return (
    <section className={css.section}>
      <div className={css.sectionHead}>
        <h3 className={css.sectionTitle}>Description</h3>
        <div className={css.tabs}>
          {(['write', 'preview'] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={css.tab}
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
            >
              {m === 'write' ? 'Write' : 'Preview'}
            </button>
          ))}
        </div>
      </div>
      {mode === 'write' ? (
        <textarea
          aria-label="Description"
          className={`${ui.input} ${css.description}`}
          maxLength={10000}
          placeholder="Add details. Markdown works: **bold**, - lists, # headings, [links](https://...)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      ) : draft.trim() ? (
        <Markdown text={draft} />
      ) : (
        <p className={ui.hint}>Nothing written yet.</p>
      )}
      {dirty ? (
        <div className={css.inline}>
          <button
            type="button"
            className={`${ui.button} ${ui.primary}`}
            onClick={() => onSave(draft)}
          >
            Save description
          </button>
          <button type="button" className={`${ui.button} ${ui.ghost}`} onClick={() => setDraft(details)}>
            Cancel
          </button>
        </div>
      ) : null}
    </section>
  )
}
