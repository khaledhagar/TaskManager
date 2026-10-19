import { Pause, Play, RotateCcw, SkipForward, Timer } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import ui from '../ui/ui.module.css'
import { format, MODES, type Mode } from './logic'
import css from './timer.module.css'
import { useFocusTimer } from './useFocusTimer'

const MODE_LABEL: Record<Mode, string> = {
  '25/5': '25 min focus, 5 min break',
  '50/10': '50 min focus, 10 min break',
}

/** Opt-in Pomodoro timer: a plain button until turned on, then a chip with a control panel. */
export function FocusTimer() {
  const t = useFocusTimer()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const { state } = t
  const phaseLabel = state.phase === 'focus' ? 'Focus' : 'Break'
  const time = format(t.left)

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
          t.enable()
          setOpen(true)
        }}
      >
        <Timer size={16} aria-hidden="true" />
        Focus timer
      </button>
    )

  const startLabel =
    state.status === 'paused' ? 'Resume' : state.phase === 'focus' ? 'Start focus' : 'Start break'

  return (
    <div ref={root} className={css.root} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <button
        type="button"
        className={css.chip}
        data-phase={state.phase}
        data-running={state.status === 'running' || undefined}
        aria-label={`Focus timer: ${time} ${phaseLabel}${state.status === 'paused' ? ', paused' : ''}`}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen(!open)}
      >
        <Timer size={16} aria-hidden="true" />
        <span className={css.chipTime}>{time}</span>
        <span>{phaseLabel}</span>
      </button>

      {open ? (
        <div id={panelId} role="dialog" aria-label="Focus timer" className={css.panel}>
          <div className={css.modes} role="group" aria-label="Timer length">
            {(Object.keys(MODES) as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={css.mode}
                aria-pressed={state.mode === m}
                aria-label={MODE_LABEL[m]}
                onClick={() => t.setMode(m)}
              >
                {m.replace('/', ' / ')}
              </button>
            ))}
          </div>

          <div className={css.clock} data-phase={state.phase}>
            <span className={css.clockTime}>{time}</span>
            <span className={css.clockPhase}>{phaseLabel}</span>
          </div>

          {state.status === 'waiting' ? (
            <p className={ui.notice}>Break is over. Start your next focus when you're ready.</p>
          ) : null}

          {state.status === 'running' ? (
            <button type="button" className={`${ui.button} ${ui.primary} ${ui.full}`} onClick={t.pause}>
              <Pause size={16} aria-hidden="true" />
              Pause
            </button>
          ) : (
            <button type="button" className={`${ui.button} ${ui.primary} ${ui.full}`} onClick={t.start}>
              <Play size={16} aria-hidden="true" />
              {startLabel}
            </button>
          )}

          <div className={css.controls}>
            <button
              type="button"
              className={`${ui.button} ${ui.secondary}`}
              disabled={state.phase !== 'focus'}
              onClick={t.resetFocus}
            >
              <RotateCcw size={14} aria-hidden="true" />
              Reset focus
            </button>
            <button
              type="button"
              className={`${ui.button} ${ui.secondary}`}
              disabled={state.phase !== 'break'}
              onClick={t.resetBreak}
            >
              <RotateCcw size={14} aria-hidden="true" />
              Reset break
            </button>
            <button type="button" className={`${ui.button} ${ui.ghost}`} onClick={t.skip}>
              <SkipForward size={14} aria-hidden="true" />
              {state.phase === 'focus' ? 'Skip to break' : 'Skip to focus'}
            </button>
          </div>

          <label className={css.option}>
            <input type="checkbox" checked={!state.muted} onChange={(e) => t.setMuted(!e.target.checked)} />
            Sound when a phase ends
          </label>
          <label className={css.option}>
            <input type="checkbox" checked={state.notify} onChange={(e) => t.setNotify(e.target.checked)} />
            Desktop notification
          </label>
          {state.notify && t.notificationsBlocked ? (
            <p className={ui.hint}>Notifications are blocked for this site in your browser settings.</p>
          ) : null}

          <button
            type="button"
            className={ui.linkButton}
            onClick={() => {
              t.disable()
              setOpen(false)
            }}
          >
            Turn off focus timer
          </button>
        </div>
      ) : null}

      <div className="visually-hidden" role="status" aria-live="polite">
        {t.announcement}
      </div>
    </div>
  )
}
