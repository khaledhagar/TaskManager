import { Sparkles, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { ai, type ChatAction, type ChatMessage } from '../api/ai'
import type { Board } from '../api/boards'
import type { BoardActions } from '../board/useBoard'
import { useI18n } from '../i18n/context'
import ui from '../ui/ui.module.css'
import css from './ai.module.css'
import { applyAction, describeAction } from './chatActions'
import { useAiRequest } from './useAiRequest'

type Status = 'proposed' | 'done' | 'dismissed'
type Entry = ChatMessage & { actions: (ChatAction & { status: Status })[] }

type Props = { open: boolean; board: Board; actions: BoardActions; onClose: () => void }

/**
 * AI assistant side panel. The conversation lives here (kept while the panel is closed).
 * Proposed board changes wait for the user's Confirm; replies are shown as plain text.
 */
export function ChatPanel({ open, board, actions, onClose }: Props) {
  const { t } = useI18n()
  const request = useAiRequest()
  const [entries, setEntries] = useState<Entry[]>([])
  const [draft, setDraft] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const inputId = useId()

  // Block body on purpose: newer browsers return a Promise from scrollIntoView, and an
  // effect must return nothing or a cleanup function.
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' })
  }, [entries, request.busy])

  async function send(event?: FormEvent) {
    event?.preventDefault()
    const content = draft.trim()
    if (!content || request.busy) return
    const history = [...entries, { role: 'user' as const, content, actions: [] }]
    setEntries(history)
    setDraft('')
    const messages = history.map(({ role, content }) => ({ role, content }))
    const answer = await request.run((signal) => ai.chat(board.id, messages, signal))
    if (answer) {
      const proposed = answer.actions.map((a) => ({ ...a, status: 'proposed' as const }))
      setEntries((all) => [...all, { role: 'assistant', content: answer.reply, actions: proposed }])
    }
  }

  function decide(entry: number, index: number, status: Status) {
    const target = entries[entry].actions[index]
    if (status === 'done') applyAction(target, board, actions)
    setEntries((all) =>
      all.map((e, i) =>
        i === entry ? { ...e, actions: e.actions.map((a, j) => (j === index ? { ...a, status } : a)) } : e,
      ),
    )
  }

  return (
    <aside
      className={css.panel}
      hidden={!open}
      aria-label={t('chat.title')}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <header className={css.panelHead}>
        <Sparkles size={16} aria-hidden="true" />
        <h2 className={css.panelTitle}>{t('chat.title')}</h2>
        <button
          type="button"
          className={ui.linkButton}
          disabled={!entries.length}
          onClick={() => {
            request.cancel()
            setEntries([])
          }}
        >
          {t('chat.clear')}
        </button>
        <button type="button" className={ui.iconButton} aria-label={t('ui.close')} onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div className={css.messages} role="log" aria-live="polite">
        {entries.length ? null : <p className={ui.hint}>{t('chat.empty')}</p>}
        {entries.map((entry, i) => (
          <div key={i} className={css.message} data-role={entry.role}>
            <p className={css.bubble} dir="auto">
              {entry.content}
            </p>
            {entry.actions.map((a, j) => (
              <Proposal
                key={j}
                text={describeAction(a, board)}
                status={a.status}
                onDecide={(status) => decide(i, j, status)}
              />
            ))}
          </div>
        ))}
        {request.busy ? (
          <div className={css.row}>
            <span className={ui.hint} role="status">
              {t('ai.thinking')}
            </span>
            <button type="button" className={ui.linkButton} onClick={request.cancel}>
              {t('ai.cancelRequest')}
            </button>
          </div>
        ) : null}
        {request.error ? (
          <p className={ui.alert} role="alert">
            {request.error}
          </p>
        ) : null}
        <div ref={end} />
      </div>

      <form className={css.compose} onSubmit={send}>
        <label className="visually-hidden" htmlFor={inputId}>
          {t('chat.message')}
        </label>
        <textarea
          id={inputId}
          dir="auto"
          className={ui.input}
          rows={2}
          maxLength={2000}
          placeholder={t('chat.placeholder')}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
        />
        <button className={`${ui.button} ${ui.primary}`} disabled={!draft.trim() || request.busy}>
          {t('chat.send')}
        </button>
        <p className={ui.hint}>{t('chat.notice')}</p>
      </form>
    </aside>
  )
}

function Proposal({ text, status, onDecide }: { text: string | null; status: Status; onDecide: (s: Status) => void }) {
  const { t } = useI18n()
  if (text === null) return <p className={css.proposal}>{t('chat.stale')}</p>
  return (
    <div className={css.proposal}>
      <span dir="auto">{text}</span>
      {status === 'proposed' ? (
        <span className={css.row}>
          <button
            type="button"
            className={`${ui.button} ${ui.primary}`}
            aria-label={t('chat.confirm', { action: text })}
            onClick={() => onDecide('done')}
          >
            {t('chat.confirmShort')}
          </button>
          <button
            type="button"
            className={`${ui.button} ${ui.ghost}`}
            aria-label={t('chat.dismiss', { action: text })}
            onClick={() => onDecide('dismissed')}
          >
            {t('chat.dismissShort')}
          </button>
        </span>
      ) : (
        <span className={ui.hint}>{t(status === 'done' ? 'ui.done' : 'chat.dismissed')}</span>
      )}
    </div>
  )
}
