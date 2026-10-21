import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import ui from './ui.module.css'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string | null
  hint?: string
  /** Shown at the end of the input, e.g. a microphone button. */
  after?: ReactNode
}

/** Labeled input with an optional hint and an error announced to screen readers. */
export function Field({ label, error, hint, after, ...input }: Props) {
  const id = useId()
  const described = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className={ui.field}>
      <label className={ui.label} htmlFor={id}>
        {label}
      </label>
      {after ? (
        <div className={ui.withAfter}>
          <input id={id} className={ui.input} aria-invalid={error ? true : undefined} aria-describedby={described} {...input} />
          {after}
        </div>
      ) : (
        <input id={id} className={ui.input} aria-invalid={error ? true : undefined} aria-describedby={described} {...input} />
      )}
      {error ? (
        <span id={`${id}-error`} className={ui.fieldError}>
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className={ui.hint}>
          {hint}
        </span>
      ) : null}
    </div>
  )
}
