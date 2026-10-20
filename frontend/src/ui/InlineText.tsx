import { useState, type ReactNode } from 'react'

type Props = {
  value: string
  onSave: (value: string) => void
  label: string
  className?: string
  inputClassName?: string
  maxLength?: number
  children?: ReactNode
}

/**
 * Text that turns into an input on click: Enter or leaving saves, Escape cancels.
 * `dir="auto"` keeps user text in its own direction inside either page direction.
 * The button is named by its visible text; `label` is its tooltip and the input's name.
 */
export function InlineText({ value, onSave, label, className, inputClassName, maxLength = 200, children }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  function finish(save: boolean) {
    const next = draft.trim()
    if (save && next && next !== value) onSave(next)
    setEditing(false)
  }

  if (!editing)
    return (
      <button
        type="button"
        dir="auto"
        className={className}
        title={label}
        onClick={() => {
          setDraft(value)
          setEditing(true)
        }}
      >
        {children ?? value}
      </button>
    )

  return (
    <input
      aria-label={label}
      dir="auto"
      className={inputClassName}
      value={draft}
      maxLength={maxLength}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(true)
        if (e.key === 'Escape') {
          e.stopPropagation()
          finish(false)
        }
      }}
    />
  )
}
