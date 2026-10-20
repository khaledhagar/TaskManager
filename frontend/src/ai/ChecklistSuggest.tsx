import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import { ai } from '../api/ai'
import { useI18n } from '../i18n/context'
import ui from '../ui/ui.module.css'
import css from './ai.module.css'
import { useAiRequest } from './useAiRequest'

type Suggestion = { text: string; picked: boolean }

/** Ask the AI for checklist steps; the user picks which ones to add. */
export function ChecklistSuggest({ cardId, onAdd }: { cardId: number; onAdd: (text: string) => Promise<unknown> }) {
  const { t } = useI18n()
  const request = useAiRequest()
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const picked = suggestions?.filter((s) => s.picked) ?? []

  async function suggest() {
    const answer = await request.run((signal) => ai.suggestChecklist(cardId, signal))
    if (answer) setSuggestions(answer.items.map((text) => ({ text, picked: true })))
  }

  async function add() {
    setSuggestions(null)
    for (const s of picked) await onAdd(s.text)
  }

  const toggle = (index: number) =>
    setSuggestions((all) => all!.map((s, i) => (i === index ? { ...s, picked: !s.picked } : s)))

  if (suggestions)
    return (
      <div className={css.suggestions}>
        <p className={css.suggestTitle}>{t('ai.suggestions')}</p>
        <ul className={css.suggestList}>
          {suggestions.map((s, i) => (
            <li key={i}>
              <label className={css.suggestItem}>
                <input type="checkbox" checked={s.picked} onChange={() => toggle(i)} />
                <span dir="auto">{s.text}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className={css.row}>
          <button type="button" className={`${ui.button} ${ui.primary}`} disabled={!picked.length} onClick={add}>
            {t('ai.addSteps', { count: picked.length })}
          </button>
          <button type="button" className={`${ui.button} ${ui.ghost}`} onClick={() => setSuggestions(null)}>
            {t('ai.discard')}
          </button>
        </div>
      </div>
    )

  return (
    <div className={css.suggest}>
      <div className={css.row}>
        <button
          type="button"
          className={`${ui.button} ${ui.secondary}`}
          disabled={request.busy}
          onClick={suggest}
        >
          <Sparkles size={16} aria-hidden="true" />
          {t('ai.suggest')}
        </button>
        {request.busy ? (
          <>
            <span className={ui.hint} role="status">
              {t('ai.thinking')}
            </span>
            <button type="button" className={ui.linkButton} onClick={request.cancel}>
              {t('ui.cancel')}
            </button>
          </>
        ) : null}
      </div>
      {request.error ? (
        <p className={ui.alert} role="alert">
          {request.error}
        </p>
      ) : null}
      <p className={ui.hint}>{t('ai.cardNotice')}</p>
    </div>
  )
}
