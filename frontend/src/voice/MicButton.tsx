import { Mic, MicOff } from 'lucide-react'
import { useRef, useState } from 'react'
import { useI18n } from '../i18n/context'
import { useToast } from '../ui/toastContext'
import { speechSupported, useSpeech } from './useSpeech'
import css from './voice.module.css'

const NOTICE = 'voiceNoticeSeen'

/** Speech services end phrases with "." or "?"; one-line fields (search, titles) drop that. */
const TRAILING = /[\s.。!?؟،,;:]+$/u

/** Join pieces of text with single spaces, skipping empty ones. */
const join = (...parts: string[]) => parts.map((p) => p.trim()).filter(Boolean).join(' ')

type Props = {
  value: string
  onChange: (value: string) => void
  /** Called when listening ends, e.g. to put focus back in the field. */
  onEnd?: () => void
  maxLength?: number
  /** Longer text (descriptions, comments, chat) keeps the punctuation the speech service adds. */
  sentences?: boolean
}

/**
 * Microphone button for a text field: spoken words appear live in the field and are added after
 * what is already there. Nothing is saved or sent; the user does that as usual. Hidden in
 * browsers without speech recognition.
 */
export function MicButton({ value, onChange, onEnd, maxLength, sentences = false }: Props) {
  const { t } = useI18n()
  const toast = useToast()
  const base = useRef('')
  const heard = useRef('')
  const [used, setUsed] = useState(false)
  const put = (text: string) => onChange(maxLength ? text.slice(0, maxLength) : text)
  const spoken = (text: string) => (sentences ? text : text.replace(TRAILING, ''))
  const speech = useSpeech({
    onInterim: (text) => put(join(base.current, heard.current, spoken(text))),
    onFinal: (text) => {
      heard.current = join(heard.current, spoken(text))
      put(join(base.current, heard.current))
    },
    onError: (key) => toast({ message: t(key), tone: 'error' }),
    onEnd: () => onEnd?.(),
  })

  if (!speechSupported()) return null

  function toggle() {
    if (speech.listening) {
      speech.stop()
      return
    }
    try {
      if (!localStorage.getItem(NOTICE)) {
        toast({ message: t('voice.notice') })
        localStorage.setItem(NOTICE, '1')
      }
    } catch {
      // Private mode: the notice may show again next time.
    }
    // One-line fields (a card or board name, search) take what is said in place of the old text;
    // longer text (descriptions, comments, chat) gets it added at the end.
    base.current = sentences ? value : ''
    heard.current = ''
    setUsed(true)
    speech.start()
  }

  return (
    <>
      <button
        type="button"
        className={css.mic}
        data-listening={speech.listening || undefined}
        aria-pressed={speech.listening}
        aria-label={t(speech.listening ? 'voice.stop' : 'voice.start')}
        title={t(speech.listening ? 'voice.stop' : 'voice.start')}
        onClick={toggle}
      >
        {speech.listening ? <MicOff size={16} aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}
      </button>
      <span className="visually-hidden" role="status">
        {speech.listening ? t('voice.listening') : used ? t('voice.stopped') : ''}
      </span>
    </>
  )
}
