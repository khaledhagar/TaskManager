import { X } from 'lucide-react'
import { useCallback, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../i18n/context'
import { ToastContext, ToastHostContext, type Show, type ToastInput } from './toastContext'

import css from './toast.module.css'

type Toast = ToastInput & { id: number }

/** Bottom-of-screen messages; read out politely by screen readers; usable above open dialogs. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [hosts, setHosts] = useState<HTMLElement[]>([])
  const register = useCallback((host: HTMLElement) => {
    setHosts((all) => [...all, host])
    return () => setHosts((all) => all.filter((h) => h !== host))
  }, [])
  const nextId = useRef(1)
  const i18n = useI18n()

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), [])

  const show = useCallback<Show>(
    (input) => {
      const id = nextId.current++
      setToasts((all) => [...all.slice(-2), { ...input, id }])
      const timer = setTimeout(() => dismiss(id), input.duration ?? 5000)
      return () => {
        clearTimeout(timer)
        dismiss(id)
      }
    },
    [dismiss],
  )

  const region = (
      <div className={css.region} role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`${css.toast} ${t.tone === 'error' ? css.error : ''}`}>
            <span>{t.message}</span>
            {t.action ? (
              <button
                type="button"
                className={css.action}
                onClick={() => {
                  t.action!.onClick()
                  dismiss(t.id)
                }}
              >
                {t.action.label}
              </button>
            ) : null}
            <button
              type="button"
              className={css.close}
              aria-label={i18n.t('ui.dismiss')}
              onClick={() => dismiss(t.id)}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
  )
  const host = hosts.at(-1)

  return (
    <ToastContext.Provider value={show}>
      <ToastHostContext.Provider value={register}>
        {children}
        {host ? createPortal(region, host) : region}
      </ToastHostContext.Provider>
    </ToastContext.Provider>
  )
}
