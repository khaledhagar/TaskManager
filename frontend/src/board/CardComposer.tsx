import { useState } from 'react'
import { useI18n } from '../i18n/context'
import ui from '../ui/ui.module.css'
import { MicButton } from '../voice/MicButton'
import voice from '../voice/voice.module.css'
import css from './column.module.css'

/** Add cards one after another: Enter adds and keeps the field open, Escape closes. */
export function CardComposer({ onAdd, onClose }: { onAdd: (title: string) => void; onClose: () => void }) {
  const { t } = useI18n()
  const [title, setTitle] = useState('')

  function add() {
    const next = title.trim()
    if (!next) return
    onAdd(next)
    setTitle('')
  }

  return (
    <div className={css.composer}>
      <div className={voice.withMic}>
      <textarea
        aria-label={t('composer.label')}
        dir="auto"
        className={`${ui.input} ${css.composerInput}`}
        placeholder={t('composer.placeholder')}
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
      <MicButton value={title} onChange={(v) => setTitle(v.replace(/\n/g, ''))} maxLength={200} />
      </div>
      <div className={css.inline}>
        <button type="button" className={`${ui.button} ${ui.primary}`} onClick={add}>
          {t('column.addCard')}
        </button>
        <button type="button" className={`${ui.button} ${ui.ghost}`} onClick={onClose}>
          {t('ui.cancel')}
        </button>
      </div>
    </div>
  )
}
