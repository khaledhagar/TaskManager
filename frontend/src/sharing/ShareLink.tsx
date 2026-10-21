import { Check, Copy, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { whatsAppLink } from '../api/sharing'
import { useI18n } from '../i18n/context'
import type { Key } from '../i18n/messages'
import ui from '../ui/ui.module.css'
import css from './sharing.module.css'

type Props = { link: string; boardTitle: string; note: string; message?: Key; linkLabel?: Key }

/** A link (invitation or public board) with Copy and Share on WhatsApp. */
export function ShareLink({ link, boardTitle, note, message = 'share.message', linkLabel = 'share.link' }: Props) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(link)
    setCopied(true)
  }

  return (
    <div className={css.share}>
      <p className={ui.notice} role="status">
        {note}
      </p>
      <label className={css.linkLabel}>
        <span className={ui.hint}>{t(linkLabel)}</span>
        <input className={`${ui.input} ${css.linkInput}`} value={link} readOnly dir="ltr" onFocus={(e) => e.target.select()} />
      </label>
      <div className={css.shareActions}>
        <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={copy}>
          {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          {copied ? t('share.copied') : t('share.copy')}
        </button>
        <a
          className={`${ui.button} ${ui.secondary}`}
          href={whatsAppLink(t(message, { title: boardTitle, link }))}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle size={16} aria-hidden="true" />
          {t('share.whatsapp')}
        </a>
      </div>
    </div>
  )
}
