/** Pomodoro timer rules as pure functions. Time left always comes from a fixed end time. */
export type Mode = '25/5' | '50/10'
export type Phase = 'focus' | 'break'
export type Status = 'idle' | 'running' | 'paused' | 'waiting'
export type TimerEvent = 'focus-ended' | 'break-ended' | null

export type TimerState = {
  enabled: boolean
  mode: Mode
  phase: Phase
  status: Status
  endsAt: number | null
  left: number
  muted: boolean
  notify: boolean
}

const MIN = 60_000
export const MODES: Record<Mode, Record<Phase, number>> = {
  '25/5': { focus: 25 * MIN, break: 5 * MIN },
  '50/10': { focus: 50 * MIN, break: 10 * MIN },
}

export const INITIAL: TimerState = {
  enabled: false,
  mode: '25/5',
  phase: 'focus',
  status: 'idle',
  endsAt: null,
  left: MODES['25/5'].focus,
  muted: false,
  notify: false,
}

const full = (s: TimerState, phase = s.phase) => MODES[s.mode][phase]

export function remaining(s: TimerState, now: number): number {
  return s.status === 'running' && s.endsAt !== null ? Math.max(0, s.endsAt - now) : s.left
}

export function format(ms: number): string {
  const total = Math.ceil(ms / 1000)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export const enable = (s: TimerState): TimerState => ({ ...s, enabled: true })

export function disable(s: TimerState): TimerState {
  return { ...INITIAL, mode: s.mode, muted: s.muted, notify: s.notify, left: MODES[s.mode].focus }
}

export function start(s: TimerState, now: number): TimerState {
  return { ...s, status: 'running', endsAt: now + s.left }
}

export function pause(s: TimerState, now: number): TimerState {
  return { ...s, status: 'paused', left: remaining(s, now), endsAt: null }
}

function restart(s: TimerState, now: number): TimerState {
  const left = full(s)
  return s.status === 'running' ? { ...s, left, endsAt: now + left } : { ...s, left, endsAt: null }
}

/** Restart the focus time; does nothing during a break. */
export const resetFocus = (s: TimerState, now: number) => (s.phase === 'focus' ? restart(s, now) : s)

/** Restart the break time; does nothing during focus. */
export const resetBreak = (s: TimerState, now: number) => (s.phase === 'break' ? restart(s, now) : s)

export function skip(s: TimerState): TimerState {
  const phase: Phase = s.phase === 'focus' ? 'break' : 'focus'
  return { ...s, phase, status: 'idle', endsAt: null, left: full(s, phase) }
}

export function setMode(s: TimerState, mode: Mode): TimerState {
  return { ...s, mode, phase: 'focus', status: 'idle', endsAt: null, left: MODES[mode].focus }
}

/**
 * Advance a running timer to `now`. Focus ending starts the break at once; the break is
 * timed from when focus ended, so time spent away still counts. A finished break waits.
 */
export function tick(s: TimerState, now: number): { state: TimerState; event: TimerEvent } {
  if (s.status !== 'running' || s.endsAt === null || now < s.endsAt) return { state: s, event: null }
  if (s.phase === 'focus') {
    const inBreak: TimerState = { ...s, phase: 'break', endsAt: s.endsAt + full(s, 'break'), left: full(s, 'break') }
    if (now < inBreak.endsAt!) return { state: inBreak, event: 'focus-ended' }
    s = inBreak
  }
  return {
    state: { ...s, phase: 'focus', status: 'waiting', endsAt: null, left: full(s, 'focus') },
    event: 'break-ended',
  }
}

/** Parse saved state; anything unexpected falls back to the initial state. */
export function load(raw: string | null): TimerState {
  try {
    const s = JSON.parse(raw ?? '') as TimerState
    const valid =
      typeof s.enabled === 'boolean' &&
      s.mode in MODES &&
      (s.phase === 'focus' || s.phase === 'break') &&
      ['idle', 'running', 'paused', 'waiting'].includes(s.status) &&
      typeof s.left === 'number' &&
      (s.endsAt === null || typeof s.endsAt === 'number')
    return valid ? { ...INITIAL, ...s } : INITIAL
  } catch {
    return INITIAL
  }
}
