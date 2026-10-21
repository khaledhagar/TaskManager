import { X } from 'lucide-react'
import { useContext, useEffect, useId, useRef, type ReactNode } from 'react'
import { useI18n } from '../i18n/context'
import css from './dialog.module.css'
import { ToastHostContext } from './toastContext'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  hideTitle?: boolean
  wide?: boolean
}

/** Native modal dialog: focus trap, Escape to close and focus return come from the browser. */
export function Dialog({ open, onClose, title, children, hideTitle = false, wide = false }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const { t } = useI18n()
  const registerToastHost = useContext(ToastHostContext)

  useEffect(() => {
    if (open && ref.current) return registerToastHost(ref.current)
  }, [open, registerToastHost])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={`${css.dialog} ${wide ? css.wide : ''}`}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      {open ? (
        <div className={css.body}>
          <header className={hideTitle ? css.floatingHeader : css.header}>
            <h2 id={titleId} className={hideTitle ? 'visually-hidden' : css.title}>
              {title}
            </h2>
            <button type="button" className={css.close} aria-label={t('ui.close')} onClick={onClose}>
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          {children}
        </div>
      ) : null}
    </dialog>
  )
}
