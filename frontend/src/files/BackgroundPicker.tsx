import { ImageUp } from 'lucide-react'
import { useId, useState } from 'react'
import type { Background, Board } from '../api/boards'
import { files } from '../api/files'
import { Dialog } from '../ui/Dialog'
import ui from '../ui/ui.module.css'
import css from './files.module.css'
import { BACKGROUND_ACCEPT, backgroundError, PRESETS, shrinkImage } from './uploads'

const title = (preset: string) => preset.charAt(0).toUpperCase() + preset.slice(1)

type Props = {
  open: boolean
  board: Board
  onClose: () => void
  onChange: (background: Background) => void
}

/** Choose a preset gradient, upload a photo (shrunk in the browser first), or remove the background. */
export function BackgroundPicker({ open, board, onClose, onChange }: Props) {
  const inputId = useId()
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
    run('Uploading photo...', async () => files.uploadBackground(board.id, await shrinkImage(file), () => {}))
  }

  return (
    <Dialog open={open} onClose={onClose} title="Board background">
      <div className={css.presets}>
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            className={css.preset}
            data-preset={p}
            aria-pressed={current.kind === 'preset' && current.preset === p}
            onClick={() => run('Saving...', () => files.setPreset(board.id, p))}
          >
            <span>{title(p)}</span>
          </button>
        ))}
      </div>
      <div className={css.photoRow}>
        <label htmlFor={inputId} className={`${ui.button} ${ui.secondary}`}>
          <ImageUp size={16} aria-hidden="true" />
          Upload a photo
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
        <span className={ui.hint}>JPG, PNG or WebP, up to 10 MB. Large photos are resized.</span>
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
            run('Removing...', async () => {
              await files.removeBackground(board.id)
              return { kind: 'none', preset: null, version: current.version + 1 }
            })
          }
        >
          Remove background
        </button>
      ) : null}
    </Dialog>
  )
}
