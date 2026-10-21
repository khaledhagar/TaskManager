import { AudioLines, Mic } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import type { Board, BoardSummary } from '../api/boards'
import { can, deniedKey } from '../board/permissions'
import { useI18n } from '../i18n/context'
import type { Key } from '../i18n/messages'
import { Dialog } from '../ui/Dialog'
import dialog from '../ui/dialog.module.css'
import { Field } from '../ui/Field'
import { useToast } from '../ui/toastContext'
import ui from '../ui/ui.module.css'
import { NEED, parseCommand, type Change, type Lookup, type Parsed } from './commands'
import { describeChange } from './describe'
import { speechSupported, useSpeech } from './useSpeech'
import css from './voice.module.css'

const HELP: Key[] = [
  'vc.help.add', 'vc.help.move', 'vc.help.complete', 'vc.help.delete', 'vc.help.rename', 'vc.help.priority',
  'vc.help.due', 'vc.help.assign', 'vc.help.column', 'vc.help.open', 'vc.help.find',
]

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The open board, or null on the start page (only board look-ups work there). */
  board: Board | null
  boards: BoardSummary[]
  me: number
  onChange: (change: Change) => void
  onLookup: (lookup: Lookup) => void
  /** Phrases not understood (two words or more) go to the AI chat; none on the start page. */
  onAskAi?: (text: string) => void
  buttonClassName: string
  labelClassName: string
}

/** "Voice command": say (or type) a command; a change is shown first and done after Confirm. */
export function VoiceCommand(props: Props) {
  const { t } = useI18n()
  return (
    <>
      <button
        type="button"
        className={props.buttonClassName}
        aria-label={t('vc.open')}
        title={`${t('vc.open')} (V)`}
        onClick={() => props.onOpenChange(true)}
      >
        <AudioLines size={16} aria-hidden="true" />
        <span className={props.labelClassName}>{t('vc.open')}</span>
      </button>
      <Dialog open={props.open} onClose={() => props.onOpenChange(false)} title={t('vc.open')}>
        {props.open ? <VoicePanel {...props} close={() => props.onOpenChange(false)} /> : null}
      </Dialog>
    </>
  )
}

function VoicePanel({ board, boards, me, onChange, onLookup, onAskAi, close }: Props & { close: () => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const [heard, setHeard] = useState('')
  const [typed, setTyped] = useState('')
  const [proposal, setProposal] = useState<Parsed | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [help, setHelp] = useState(false)
  const speech = useSpeech({
    onInterim: setHeard,
    onFinal: (text) => {
      setHeard(text)
      handle(text)
    },
    onError: (k) => setMessage(t(k)),
    onEnd: () => {},
  })

  // Opening the window starts listening (the person pressed the button or V for this).
  useEffect(() => {
    if (speechSupported()) speech.start()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the window opens
  }, [])

  function handle(text: string) {
    show(parseCommand(text, { board, boards, me, today: new Date() }), text)
  }

  function show(parsed: Parsed, text: string) {
    setMessage(null)
    setHelp(false)
    setProposal(null)
    if (parsed.kind === 'lookup') {
      if (parsed.lookup.type === 'help') return setHelp(true)
      onLookup(parsed.lookup)
      return close()
    }
    if (parsed.kind === 'change') {
      const need = NEED[parsed.change.type]
      if (board && !can(board.role, need)) return setMessage(t(deniedKey(board.role, need)))
      return setProposal(parsed)
    }
    if (parsed.kind === 'choose') return setProposal(parsed)
    if (parsed.kind === 'notFound') return setMessage(t(`vc.notFound.${parsed.what}`, { name: parsed.name }))
    if (parsed.kind === 'needBoard') return setMessage(t('vc.needBoard'))
    // Not understood: longer phrases go to the AI chat; a single word is too likely a mishearing.
    if (onAskAi && text.trim().split(/\s+/).length >= 2) {
      onAskAi(text.trim())
      return close()
    }
    setMessage(t('vc.unknown'))
    setHelp(true)
  }

  function confirm(change: Change) {
    const sentence = describeChange(change, board!, me)
    onChange(change)
    toast({ message: t('vc.done', { sentence }) })
    close()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (typed.trim()) handle(typed)
  }

  return (
    <div className={css.panel}>
      <p className={css.status} role="status">
        {speech.listening ? t('vc.listening') : heard ? t('vc.heard', { text: heard }) : ''}
      </p>
      {message ? <p className={ui.notice}>{message}</p> : null}

      {proposal?.kind === 'change' && board ? (
        <div className={css.proposal}>
          <p className={css.sentence} dir="auto">
            {describeChange(proposal.change, board, me)}
          </p>
          <div className={dialog.actions}>
            <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={() => setProposal(null)}>
              {t('vc.cancel')}
            </button>
            <button type="button" className={`${ui.button} ${ui.primary}`} autoFocus onClick={() => confirm(proposal.change)}>
              {t('vc.confirm')}
            </button>
          </div>
        </div>
      ) : null}

      {proposal?.kind === 'choose' ? (
        <div className={css.proposal} role="group" aria-label={t('vc.choose')}>
          <p className={css.sentence}>{t('vc.choose')}</p>
          {proposal.options.map((o, i) => (
            <button key={i} type="button" className={`${ui.button} ${ui.secondary}`} dir="auto" onClick={() => show(o.result, '')}>
              {o.label}
            </button>
          ))}
        </div>
      ) : null}

      <form onSubmit={submit} className={css.typed}>
        <Field
          label={t('vc.typeLabel')}
          hint={t('vc.typeHint')}
          value={typed}
          dir="auto"
          maxLength={300}
          autoFocus={!speechSupported()}
          onChange={(e) => setTyped(e.target.value)}
        />
        <button className={`${ui.button} ${ui.secondary}`}>{t('vc.run')}</button>
      </form>

      <div className={css.row}>
        {speechSupported() ? (
          <button
            type="button"
            className={`${ui.button} ${ui.ghost}`}
            disabled={speech.listening}
            onClick={() => {
              setHeard('')
              setMessage(null)
              speech.start()
            }}
          >
            <Mic size={16} aria-hidden="true" />
            {t('vc.listenAgain')}
          </button>
        ) : null}
        <button type="button" className={ui.linkButton} onClick={() => setHelp(!help)} aria-expanded={help}>
          {t('vc.helpTitle')}
        </button>
      </div>

      {help ? (
        <section aria-label={t('vc.helpTitle')}>
          <ul className={css.help}>
            {HELP.map((k) => (
              <li key={k} dir="auto">
                {t(k)}
              </li>
            ))}
          </ul>
          <p className={ui.hint}>{t('vc.help.ai')}</p>
        </section>
      ) : null}
    </div>
  )
}
