import { Pause, Play, RotateCcw, SkipForward, Timer } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useI18n } from '../i18n/context'
import type { Key } from '../i18n/messages'
import ui from '../ui/ui.module.css'
import { format, MODES, type Mode } from './logic'
import css from './timer.module.css'
import { useFocusTimer } from './useFocusTimer'

const MODE_LABEL: Record<Mode, Key> = {
  '25/5': 'timer.mode25',
  '50/10': 'timer.mode50',
}

/** Opt-in Pomodoro timer: a plain button until turned on, then a chip with a control panel. */
export function FocusTimer() {
  const timer = useFocusTimer()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const { state } = timer
  const phaseLabel = t(state.phase === 'focus' ? 'timer.focus' : 'timer.break')
  const time = format(timer.left)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  if (!state.enabled)
    return (
      <button
        type="button"
        className={css.enable}
        onClick={() => {
          timer.enable()
          setOpen(true)
        }}
      >
        <Timer size={16} aria-hidden="true" />
        {t('timer.button')}
      </button>
    )

  const startLabel =
    t(state.status === 'paused' ? 'timer.resume' : state.phase === 'focus' ? 'timer.startFocus' : 'timer.startBreak')

  return (
    <div ref={root} className={css.root} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <button
        type="button"
        className={css.chip}
        data-phase={state.phase}
        data-running={state.status === 'running' || undefined}
        aria-label={t(state.status === 'paused' ? 'timer.chipPaused' : 'timer.chip', { time, phase: phaseLabel })}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen(!open)}
      >
        <Timer size={16} aria-hidden="true" />
        <span className={css.chipTime}>{time}</span>
        <span>{phaseLabel}</span>
      </button>

      {open ? (
        <div id={panelId} role="dialog" aria-label={t('timer.button')} className={css.panel}>
          <div className={css.modes} role="group" aria-label={t('timer.length')}>
            {(Object.keys(MODES) as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={css.mode}
                aria-pressed={state.mode === m}
                aria-label={t(MODE_LABEL[m])}
                onClick={() => timer.setMode(m)}
              >
                <span dir="ltr">{m.replace('/', ' / ')}</span>
              </button>
            ))}
          </div>

          <div className={css.clock} data-phase={state.phase}>
            <span className={css.clockTime}>{time}</span>
            <span className={css.clockPhase}>{phaseLabel}</span>
          </div>

          {state.status === 'waiting' ? (
            <p className={ui.notice}>{t('timer.breakOver')}</p>
          ) : null}

          {state.status === 'running' ? (
            <button type="button" className={`${ui.button} ${ui.primary} ${ui.full}`} onClick={timer.pause}>
              <Pause size={16} aria-hidden="true" />
              {t('timer.pause')}
            </button>
          ) : (
            <button type="button" className={`${ui.button} ${ui.primary} ${ui.full}`} onClick={timer.start}>
              <Play size={16} aria-hidden="true" />
              {startLabel}
            </button>
          )}

          <div className={css.controls}>
            <button
              type="button"
              className={`${ui.button} ${ui.secondary}`}
              disabled={state.phase !== 'focus'}
              onClick={timer.resetFocus}
            >
              <RotateCcw size={14} aria-hidden="true" />
              {t('timer.resetFocus')}
            </button>
            <button
              type="button"
              className={`${ui.button} ${ui.secondary}`}
              disabled={state.phase !== 'break'}
              onClick={timer.resetBreak}
            >
              <RotateCcw size={14} aria-hidden="true" />
              {t('timer.resetBreak')}
            </button>
            <button type="button" className={`${ui.button} ${ui.ghost}`} onClick={timer.skip}>
              <SkipForward size={14} className="flip-rtl" aria-hidden="true" />
              {t(state.phase === 'focus' ? 'timer.skipToBreak' : 'timer.skipToFocus')}
            </button>
          </div>

          <label className={css.option}>
            <input type="checkbox" checked={!state.muted} onChange={(e) => timer.setMuted(!e.target.checked)} />
            {t('timer.sound')}
          </label>
          <label className={css.option}>
            <input type="checkbox" checked={state.notify} onChange={(e) => timer.setNotify(e.target.checked)} />
            {t('timer.notify')}
          </label>
          {state.notify && timer.notificationsBlocked ? (
            <p className={ui.hint}>{t('timer.blocked')}</p>
          ) : null}

          <button
            type="button"
            className={`${ui.linkButton} ${css.off}`}
            onClick={() => {
              timer.disable()
              setOpen(false)
            }}
          >
            {t('timer.off')}
          </button>
        </div>
      ) : null}

      <div className="visually-hidden" role="status" aria-live="polite">
        {timer.announcement}
      </div>
    </div>
  )
}
