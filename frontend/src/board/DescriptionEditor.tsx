import { useState } from 'react'
import { useI18n } from '../i18n/context'
import ui from '../ui/ui.module.css'
import { MicButton } from '../voice/MicButton'
import voice from '../voice/voice.module.css'
import css from './cardWindow.module.css'
import { Markdown } from './Markdown'

/** Markdown description with Write and Preview modes; saved explicitly. */
export function DescriptionEditor({ details, onSave }: { details: string; onSave: (text: string) => void }) {
  const { t } = useI18n()
  const [mode, setMode] = useState<'write' | 'preview'>(details ? 'preview' : 'write')
  const [draft, setDraft] = useState(details)
  const dirty = draft !== details

  return (
    <section className={css.section}>
      <div className={css.sectionHead}>
        <h3 className={css.sectionTitle}>{t('description.title')}</h3>
        <div className={css.tabs}>
          {(['write', 'preview'] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={css.tab}
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
            >
              {t(m === 'write' ? 'description.write' : 'description.preview')}
            </button>
          ))}
        </div>
      </div>
      {mode === 'write' ? (
        <div className={voice.withMic}>
        <textarea
          aria-label={t('description.title')}
          dir="auto"
          className={`${ui.input} ${css.description}`}
          maxLength={10000}
          placeholder={t('description.placeholder')}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && dirty) onSave(draft)
          }}
        />
        <MicButton value={draft} onChange={setDraft} maxLength={10000} sentences />
        </div>
      ) : draft.trim() ? (
        <Markdown text={draft} />
      ) : (
        <p className={ui.hint}>{t('description.empty')}</p>
      )}
      {dirty ? (
        <div className={css.inline}>
          <button
            type="button"
            className={`${ui.button} ${ui.primary}`}
            onClick={() => onSave(draft)}
          >
            {t('description.save')}
          </button>
          <button type="button" className={`${ui.button} ${ui.ghost}`} onClick={() => setDraft(details)}>
            {t('ui.cancel')}
          </button>
        </div>
      ) : null}
    </section>
  )
}
