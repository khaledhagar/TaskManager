import { X } from 'lucide-react'
import { useCallback, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../i18n/context'
import { ToastContext, type Show, type ToastInput } from './toastContext'

import css from './toast.module.css'

type Toast = ToastInput & { id: number }

/** Bottom-of-screen messages; read out politely by screen readers. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
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

  return (
    <ToastContext.Provider value={show}>
      {children}
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
    </ToastContext.Provider>
  )
}
