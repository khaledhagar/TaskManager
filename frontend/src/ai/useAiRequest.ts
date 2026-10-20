import { useEffect, useRef, useState } from 'react'

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError'

/** One AI request at a time: busy flag, friendly error, and Cancel (also on unmount). */
export function useAiRequest() {
  const controller = useRef<AbortController | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => () => controller.current?.abort(), [])

  /** Run `request`; resolves to null when it failed or was cancelled. */
  async function run<T>(request: (signal: AbortSignal) => Promise<T>): Promise<T | null> {
    controller.current?.abort()
    const current = new AbortController()
    controller.current = current
    setBusy(true)
    setError(null)
    try {
      return await request(current.signal)
    } catch (e) {
      if (!isAbort(e)) setError(e instanceof Error ? e.message : String(e))
      return null
    } finally {
      if (controller.current === current) {
        controller.current = null
        setBusy(false)
      }
    }
  }

  function cancel() {
    controller.current?.abort()
    controller.current = null
    setBusy(false)
  }

  return { run, cancel, busy, error }
}
