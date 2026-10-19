import { useId, type InputHTMLAttributes } from 'react'
import ui from './ui.module.css'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string | null
  hint?: string
}

/** Labeled input with an optional hint and an error announced to screen readers. */
export function Field({ label, error, hint, ...input }: Props) {
  const id = useId()
  const described = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className={ui.field}>
      <label className={ui.label} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={ui.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        {...input}
      />
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
