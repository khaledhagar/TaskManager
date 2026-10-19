import { createContext, useContext } from 'react'

export type ToastInput = {
  message: string
  tone?: 'info' | 'error'
  action?: { label: string; onClick: () => void }
  duration?: number
}
export type Show = (toast: ToastInput) => () => void

export const ToastContext = createContext<Show>(() => () => {})

/** Show a toast; returns a function that dismisses it. */
export const useToast = () => useContext(ToastContext)
