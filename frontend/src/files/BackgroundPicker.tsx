import { ImageUp } from 'lucide-react'
import { useId, useState } from 'react'
import type { Background, Board } from '../api/boards'
import { files } from '../api/files'
import { useI18n } from '../i18n/context'
import { Dialog } from '../ui/Dialog'
import ui from '../ui/ui.module.css'
import css from './files.module.css'
import { BACKGROUND_ACCEPT, backgroundError, PRESETS, shrinkImage } from './uploads'

type Props = {
  open: boolean
  board: Board
  onClose: () => void
  onChange: (background: Background) => void
}

/** Choose a preset gradient, upload a photo (shrunk in the browser first), or remove the background. */
export function BackgroundPicker({ open, board, onClose, onChange }: Props) {
  const inputId = useId()
  const { t } = useI18n()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const current = board.background

  async function run(label: string, task: () => Promise<Background>) {
    setError(null)
    setBusy(label)
    try {
      onChange(await task())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  function uploadPhoto(file: File | undefined) {
    if (!file) return
    const problem = backgroundError(file)
    if (problem) return setError(problem)
    run(t('background.uploading'), async () => files.uploadBackground(board.id, await shrinkImage(file), () => {}))
  }

  return (
    <Dialog open={open} onClose={onClose} title={t('background.title')}>
      <div className={css.presets}>
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            className={css.preset}
            data-preset={p}
            aria-pressed={current.kind === 'preset' && current.preset === p}
            onClick={() => run(t('background.saving'), () => files.setPreset(board.id, p))}
          >
            <span>{t(`preset.${p}`)}</span>
          </button>
        ))}
      </div>
      <div className={css.photoRow}>
        <label htmlFor={inputId} className={`${ui.button} ${ui.secondary}`}>
          <ImageUp size={16} aria-hidden="true" />
          {t('background.upload')}
        </label>
        <input
          id={inputId}
          type="file"
          accept={BACKGROUND_ACCEPT}
          className="visually-hidden"
          onChange={(e) => {
            uploadPhoto(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <span className={ui.hint}>{t('background.hint')}</span>
      </div>
      {busy ? (
        <p className={ui.hint} role="status">
          {busy}
        </p>
      ) : null}
      {error ? (
        <p className={ui.alert} role="alert">
          {error}
        </p>
      ) : null}
      {current.kind !== 'none' ? (
        <button
          type="button"
          className={`${ui.button} ${ui.ghost}`}
          onClick={() =>
            run(t('background.removing'), async () => {
              await files.removeBackground(board.id)
              return { kind: 'none', preset: null, version: current.version + 1 }
            })
          }
        >
          {t('background.remove')}
        </button>
      ) : null}
    </Dialog>
  )
}
