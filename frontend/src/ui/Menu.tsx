import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import css from './menu.module.css'

export type MenuItem =
  | { kind: 'action'; label: string; onSelect: () => void; checked?: boolean; danger?: boolean }
  | { kind: 'note'; label: string }
  | { kind: 'separator' }

type Props = {
  label: string
  trigger: ReactNode
  items: MenuItem[]
  align?: 'start' | 'end'
  triggerClassName?: string
}

/** Button that opens a list of actions. Escape or a click outside closes it. */
export function Menu({ label, trigger, items, align = 'start', triggerClassName }: Props) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    root.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus()
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false)
      button.current?.focus()
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const entries = [...(root.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])]
      const index = entries.indexOf(document.activeElement as HTMLElement)
      const step = e.key === 'ArrowDown' ? 1 : -1
      entries[(index + step + entries.length) % entries.length]?.focus()
    }
  }

  function select(action: () => void) {
    setOpen(false)
    button.current?.focus()
    action()
  }

  return (
    <div ref={root} className={css.root} onKeyDown={onKeyDown}>
      <button
        ref={button}
        type="button"
        className={triggerClassName}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)}
      >
        {trigger}
      </button>
      {open ? (
        <div id={id} role="menu" aria-label={label} className={`${css.menu} ${css[align]}`}>
          {items.map((item, i) => {
            if (item.kind === 'separator') return <div key={i} role="separator" className={css.sep} />
            if (item.kind === 'note')
              return (
                <div key={i} className={css.note}>
                  {item.label}
                </div>
              )
            return (
              <button
                key={i}
                type="button"
                role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
                aria-checked={item.checked}
                tabIndex={-1}
                className={`${css.item} ${item.danger ? css.danger : ''}`}
                onClick={() => select(item.onSelect)}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
