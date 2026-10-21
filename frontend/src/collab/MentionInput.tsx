import { useId, useRef, useState, type KeyboardEvent } from 'react'
import type { Board } from '../api/boards'
import { useI18n } from '../i18n/context'
import ui from '../ui/ui.module.css'
import { MicButton } from '../voice/MicButton'
import voice from '../voice/voice.module.css'
import css from './collab.module.css'

type Props = {
  value: string
  onChange: (value: string) => void
  members: Board['members']
  label: string
  placeholder?: string
  /** Ctrl or Cmd + Enter. */
  onSubmit?: () => void
  autoFocus?: boolean
}

/** The "@word" being typed just before the caret, if any. */
function mentionAt(text: string, caret: number): { start: number; query: string } | null {
  const match = /(^|\s)@([^\s@]*)$/.exec(text.slice(0, caret))
  return match ? { start: caret - match[2].length - 1, query: match[2].toLowerCase() } : null
}

/**
 * Comment field: typing @ suggests board members (arrow keys and Enter, or a click, pick one and
 * insert "@email "). Follows the combobox pattern so screen readers hear the suggestions.
 */
export function MentionInput({ value, onChange, members, label, placeholder, onSubmit, autoFocus }: Props) {
  const { t } = useI18n()
  const listId = useId()
  const field = useRef<HTMLTextAreaElement>(null)
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null)
  const [active, setActive] = useState(0)
  const options = mention
    ? members.filter((m) => m.email && m.email.toLowerCase().includes(mention.query)).slice(0, 5)
    : []
  const open = options.length > 0

  function update(text: string, caret: number) {
    onChange(text)
    setMention(mentionAt(text, caret))
    setActive(0)
  }

  function pick(email: string) {
    if (!mention) return
    const end = mention.start + 1 + mention.query.length
    const text = `${value.slice(0, mention.start)}@${email} ${value.slice(end)}`
    onChange(text)
    setMention(null)
    const caret = mention.start + email.length + 2
    requestAnimationFrame(() => field.current?.setSelectionRange(caret, caret))
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length)
    } else if (open && (e.key === 'Enter' || e.key === 'Tab')) {
      e.preventDefault()
      pick(options[active].email!)
    } else if (open && e.key === 'Escape') {
      e.stopPropagation()
      setMention(null)
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      onSubmit?.()
    }
  }

  return (
    <div className={css.mention}>
      <div className={voice.withMic}>
        <textarea
          ref={field}
          role="combobox"
          aria-label={label}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open ? `${listId}-${active}` : undefined}
          dir="auto"
          className={`${ui.input} ${css.commentInput}`}
          rows={2}
          maxLength={5000}
          placeholder={placeholder}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => update(e.target.value, e.target.selectionStart)}
          onKeyDown={onKeyDown}
          onBlur={() => setMention(null)}
        />
        <MicButton value={value} onChange={onChange} maxLength={5000} />
      </div>
      <ul id={listId} role="listbox" aria-label={t('mention.list')} className={css.suggestions} hidden={!open}>
        {options.map((m, i) => (
          <li
            key={m.user_id}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            className={css.suggestion}
            dir="ltr"
            onMouseDown={(e) => {
              e.preventDefault()
              pick(m.email!)
            }}
          >
            @{m.email}
          </li>
        ))}
      </ul>
    </div>
  )
}
