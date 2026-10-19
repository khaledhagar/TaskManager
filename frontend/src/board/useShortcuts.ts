import { useEffect, useRef } from 'react'

const TYPING = 'input, textarea, select, [contenteditable="true"]'

/**
 * Single-key shortcuts for the board. Ignored while typing, with modifier keys,
 * or when a dialog is open.
 */
export function useShortcuts(handlers: Record<string, () => void>) {
  const latest = useRef(handlers)
  useEffect(() => {
    latest.current = handlers
  })

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return
      if ((e.target as Element | null)?.closest?.(TYPING)) return
      if (document.querySelector('dialog[open]')) return
      const handler = latest.current[e.key.toLowerCase()] ?? latest.current[e.key]
      if (!handler) return
      e.preventDefault()
      handler()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])
}
