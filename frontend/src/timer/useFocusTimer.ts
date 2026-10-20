import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/context'
import { t } from '../i18n/language'
import * as logic from './logic'
import { playChime } from './sound'

const KEY = 'focusTimer'

function read(): logic.TimerState {
  try {
    return logic.load(localStorage.getItem(KEY))
  } catch {
    return logic.INITIAL
  }
}

function message(event: logic.TimerEvent, state: logic.TimerState): string {
  const minutes = logic.MODES[state.mode].break / 60_000
  return event === 'focus-ended'
    ? t('timer.focusOver', { minutes })
    : t('timer.breakOver')
}

/** Focus timer state saved per browser, with chime, notification, tab title and announcements. */
export function useFocusTimer() {
  const [state, setState] = useState(read)
  const [now, setNow] = useState(() => Date.now())
  const [announcement, setAnnouncement] = useState('')
  // Latest state, updated at once so back-to-back ticks never handle the same phase end twice.
  const latest = useRef(state)

  function update(next: logic.TimerState) {
    latest.current = next
    setState(next)
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      // Storage can be blocked; the timer still works until the page closes.
    }
  }

  useEffect(() => {
    if (state.status !== 'running') return
    function step() {
      const at = Date.now()
      setNow(at)
      const { state: next, event } = logic.tick(latest.current, at)
      if (!event) return
      update(next)
      const text = message(event, next)
      setAnnouncement(text)
      if (!next.muted) playChime()
      if (next.notify && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(t('app.title'), { body: text })
      }
    }
    step()
    const id = setInterval(step, 1000)
    return () => clearInterval(id)
  }, [state])

  const left = logic.remaining(state, now)
  const showing = state.enabled && (state.status === 'running' || state.status === 'paused')

  const { lang } = useI18n()
  useEffect(() => {
    const phase = t(state.phase === 'focus' ? 'timer.focus' : 'timer.break')
    document.title = showing ? `${logic.format(left)} ${phase} - ${t('app.title')}` : t('app.title')
  }, [showing, left, state.phase, lang])

  useEffect(() => () => void (document.title = t('app.title')), [])

  const act = (fn: (s: logic.TimerState, t: number) => logic.TimerState) => () => {
    const t = Date.now()
    setNow(t)
    update(fn(latest.current, t))
  }

  async function setNotify(on: boolean) {
    if (on && 'Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
    update({ ...latest.current, notify: on })
  }

  return {
    state,
    left,
    announcement,
    notificationsBlocked: 'Notification' in window && Notification.permission === 'denied',
    enable: act(logic.enable),
    disable: act((s) => logic.disable(s)),
    start: act(logic.start),
    pause: act(logic.pause),
    resetFocus: act(logic.resetFocus),
    resetBreak: act(logic.resetBreak),
    skip: act((s) => logic.skip(s)),
    setMode: (mode: logic.Mode) => update(logic.setMode(latest.current, mode)),
    setMuted: (muted: boolean) => update({ ...latest.current, muted }),
    setNotify,
  }
}
