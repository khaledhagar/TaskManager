import { Sparkles } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { ai } from '../api/ai'
import { boards, type BoardSummary, type Template } from '../api/boards'
import aiCss from '../ai/ai.module.css'
import { useAiRequest } from '../ai/useAiRequest'
import { useI18n } from '../i18n/context'
import type { Key } from '../i18n/messages'
import { Dialog } from '../ui/Dialog'
import dialog from '../ui/dialog.module.css'
import { Field } from '../ui/Field'
import ui from '../ui/ui.module.css'
import { MicButton } from '../voice/MicButton'
import voice from '../voice/voice.module.css'
import css from './shell.module.css'

type Props = { open: boolean; onClose: () => void; onCreated: (board: BoardSummary) => void }
type Choice = Template | 'ai'

const CHOICES: { value: Choice; label: Key; hint: Key }[] = [
  { value: 'blank', label: 'newBoard.blank', hint: 'newBoard.hint' },
  { value: 'sprint', label: 'newBoard.sprint', hint: 'newBoard.sprintHint' },
  { value: 'bug_tracking', label: 'newBoard.bugs', hint: 'newBoard.bugsHint' },
  { value: 'personal', label: 'newBoard.personal', hint: 'newBoard.personalHint' },
  { value: 'ai', label: 'newBoard.ai', hint: 'newBoard.aiHint' },
]

/** Start a board: blank, from a template, or built by the AI from a description. */
export function NewBoardDialog({ open, onClose, onCreated }: Props) {
  const { t } = useI18n()
  return (
    <Dialog open={open} onClose={onClose} title={t('shell.newBoard')}>
      <NewBoardForm onClose={onClose} onCreated={onCreated} />
    </Dialog>
  )
}

function NewBoardForm({ onClose, onCreated }: Omit<Props, 'open'>) {
  const { t } = useI18n()
  const request = useAiRequest()
  const id = useId()
  const [choice, setChoice] = useState<Choice>('blank')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const hint = CHOICES.find((c) => c.value === choice)!.hint

  function done(board: BoardSummary) {
    onCreated(board)
    onClose()
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (choice === 'ai') return createWithAi()
    if (!title.trim()) return setFieldError(t('newBoard.nameMissing'))
    setBusy(true)
    try {
      done(await boards.create(title.trim(), choice))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  async function createWithAi() {
    if (!description.trim()) return setFieldError(t('newBoard.describeMissing'))
    const board = await request.run((signal) => ai.startBoard(description.trim(), signal))
    if (board) done(board)
  }

  const shownError = error ?? request.error

  return (
    <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 14 }}>
      {shownError ? (
        <p className={ui.alert} role="alert">
          {shownError}
        </p>
      ) : null}
      <fieldset className={css.choices}>
        <legend className={ui.label}>{t('newBoard.startFrom')}</legend>
        {CHOICES.map((c) => (
          <label key={c.value} className={css.choice}>
            <input
              type="radio"
              name="start"
              checked={choice === c.value}
              disabled={request.busy}
              onChange={() => {
                setChoice(c.value)
                setFieldError(null)
              }}
            />
            {c.value === 'ai' ? <Sparkles size={14} aria-hidden="true" /> : null}
            {t(c.label)}
          </label>
        ))}
      </fieldset>

      {choice === 'ai' ? (
        <div className={ui.field}>
          <label className={ui.label} htmlFor={id}>
            {t('newBoard.describe')}
          </label>
          <div className={voice.withMic}>
          <textarea
            id={id}
            dir="auto"
            className={ui.input}
            rows={4}
            maxLength={500}
            autoFocus
            placeholder={t('newBoard.describePlaceholder')}
            value={description}
            disabled={request.busy}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? `${id}-error ${id}-hint` : `${id}-hint`}
            onChange={(e) => setDescription(e.target.value)}
          />
          <MicButton value={description} onChange={setDescription} maxLength={500} />
          </div>
          {fieldError ? (
            <span id={`${id}-error`} className={ui.fieldError}>
              {fieldError}
            </span>
          ) : null}
          <span id={`${id}-hint`} className={ui.hint}>
            {t(hint)}
          </span>
        </div>
      ) : (
        <Field
          label={t('newBoard.name')}
          value={title}
          maxLength={200}
          autoFocus
          dir="auto"
          placeholder={t('newBoard.placeholder')}
          onChange={(e) => setTitle(e.target.value)}
          after={<MicButton value={title} onChange={setTitle} maxLength={200} />}
          error={fieldError}
          hint={t(hint)}
        />
      )}

      {request.busy ? (
        <div className={aiCss.row}>
          <span className={ui.hint} role="status">
            {t('newBoard.building')}
          </span>
          <button type="button" className={ui.linkButton} onClick={request.cancel}>
            {t('ai.cancelRequest')}
          </button>
        </div>
      ) : null}

      <div className={dialog.actions}>
        <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={onClose}>
          {t('ui.cancel')}
        </button>
        <button className={`${ui.button} ${ui.primary}`} disabled={busy || request.busy}>
          {t(choice === 'ai' ? 'newBoard.createAi' : 'newBoard.create')}
        </button>
      </div>
    </form>
  )
}
