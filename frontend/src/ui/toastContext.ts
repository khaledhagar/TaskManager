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

/**
 * An open modal dialog makes the rest of the page inert, so toasts are drawn inside the topmost
 * open dialog. A dialog registers its element while open; the returned function unregisters it.
 */
export const ToastHostContext = createContext<(host: HTMLElement) => () => void>(() => () => {})
