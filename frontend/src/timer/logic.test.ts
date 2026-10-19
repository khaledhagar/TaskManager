import { describe, expect, test } from 'vitest'
import {
  disable,
  enable,
  format,
  INITIAL,
  load,
  pause,
  remaining,
  resetBreak,
  resetFocus,
  setMode,
  skip,
  start,
  tick,
  type TimerState,
} from './logic'

const MIN = 60_000
const T0 = 1_000_000

const running = (state: TimerState) => start(state, T0)

describe('countdown from a fixed end time (T-225)', () => {
  test('starts idle with the full focus time and counts from the end time', () => {
    expect(remaining(INITIAL, T0)).toBe(25 * MIN)
    const s = running(enable(INITIAL))
    expect(s.status).toBe('running')
    expect(s.endsAt).toBe(T0 + 25 * MIN)
    expect(remaining(s, T0 + 10 * MIN)).toBe(15 * MIN)
  })

  test('survives a reload: saved state gives the same time left', () => {
    const s = running(enable(INITIAL))
    const restored = load(JSON.stringify(s))
    expect(remaining(restored, T0 + 7 * MIN)).toBe(18 * MIN)
  })

  test('broken or missing saved state falls back to the initial state', () => {
    expect(load(null)).toEqual(INITIAL)
    expect(load('{not json')).toEqual(INITIAL)
    expect(load(JSON.stringify({ enabled: true, mode: 'nope' }))).toEqual(INITIAL)
  })

  test('format shows minutes and seconds', () => {
    expect(format(25 * MIN)).toBe('25:00')
    expect(format(61_500)).toBe('01:02')
    expect(format(0)).toBe('00:00')
  })
})

describe('phase changes (T-226)', () => {
  test('focus end starts the break right away', () => {
    const { state, event } = tick(running(enable(INITIAL)), T0 + 25 * MIN)
    expect(event).toBe('focus-ended')
    expect(state.phase).toBe('break')
    expect(state.status).toBe('running')
    expect(remaining(state, T0 + 25 * MIN)).toBe(5 * MIN)
  })

  test('break end waits for the user before the next focus', () => {
    const inBreak = tick(running(enable(INITIAL)), T0 + 25 * MIN).state
    const { state, event } = tick(inBreak, T0 + 30 * MIN)
    expect(event).toBe('break-ended')
    expect(state.phase).toBe('focus')
    expect(state.status).toBe('waiting')
    expect(remaining(state, T0 + 31 * MIN)).toBe(25 * MIN)
  })

  test('away longer than focus and break: the break is counted from when focus ended', () => {
    const { state, event } = tick(running(enable(INITIAL)), T0 + 40 * MIN)
    expect(event).toBe('break-ended')
    expect(state.status).toBe('waiting')
  })

  test('no event while time is left', () => {
    const s = running(enable(INITIAL))
    expect(tick(s, T0 + MIN).event).toBeNull()
  })
})

describe('reset focus and reset break (T-227)', () => {
  test('reset focus restarts only the focus time', () => {
    const s = running(enable(INITIAL))
    const reset = resetFocus(s, T0 + 10 * MIN)
    expect(reset.phase).toBe('focus')
    expect(reset.status).toBe('running')
    expect(remaining(reset, T0 + 10 * MIN)).toBe(25 * MIN)
  })

  test('reset break restarts only the break time', () => {
    const inBreak = tick(running(enable(INITIAL)), T0 + 25 * MIN).state
    const reset = resetBreak(inBreak, T0 + 28 * MIN)
    expect(reset.phase).toBe('break')
    expect(remaining(reset, T0 + 28 * MIN)).toBe(5 * MIN)
  })

  test('each reset does nothing in the other phase', () => {
    const focus = running(enable(INITIAL))
    expect(resetBreak(focus, T0 + MIN)).toBe(focus)
    const inBreak = tick(focus, T0 + 25 * MIN).state
    expect(resetFocus(inBreak, T0 + 26 * MIN)).toBe(inBreak)
  })

  test('reset while paused keeps it paused with the full time', () => {
    const paused = pause(running(enable(INITIAL)), T0 + 5 * MIN)
    const reset = resetFocus(paused, T0 + 6 * MIN)
    expect(reset.status).toBe('paused')
    expect(remaining(reset, T0 + 9 * MIN)).toBe(25 * MIN)
  })
})

describe('modes (T-228)', () => {
  test('50/10 uses 50 minutes of focus and 10 of break', () => {
    const s = running(setMode(enable(INITIAL), '50/10'))
    expect(remaining(s, T0)).toBe(50 * MIN)
    const inBreak = tick(s, T0 + 50 * MIN).state
    expect(remaining(inBreak, T0 + 50 * MIN)).toBe(10 * MIN)
  })

  test('switching mode resets cleanly to an idle focus', () => {
    const inBreak = tick(running(enable(INITIAL)), T0 + 25 * MIN).state
    const switched = setMode(inBreak, '50/10')
    expect(switched).toMatchObject({ mode: '50/10', phase: 'focus', status: 'idle', endsAt: null })
    expect(remaining(switched, T0)).toBe(50 * MIN)
  })
})

describe('pause and skip (T-229)', () => {
  test('pause keeps the remaining time, start continues from it', () => {
    const paused = pause(running(enable(INITIAL)), T0 + 10 * MIN)
    expect(paused.status).toBe('paused')
    expect(remaining(paused, T0 + 60 * MIN)).toBe(15 * MIN)
    const resumed = start(paused, T0 + 60 * MIN)
    expect(remaining(resumed, T0 + 61 * MIN)).toBe(14 * MIN)
  })

  test('skip moves to the other phase, ready to start', () => {
    const toBreak = skip(running(enable(INITIAL)))
    expect(toBreak).toMatchObject({ phase: 'break', status: 'idle', endsAt: null })
    expect(remaining(toBreak, T0)).toBe(5 * MIN)
    expect(skip(toBreak)).toMatchObject({ phase: 'focus', status: 'idle' })
  })
})

describe('on and off (T-231)', () => {
  test('off by default; turning off clears the timer but keeps mode and sound choice', () => {
    expect(INITIAL.enabled).toBe(false)
    const custom = { ...running(setMode(enable(INITIAL), '50/10')), muted: true }
    const off = disable(custom)
    expect(off).toMatchObject({ enabled: false, status: 'idle', endsAt: null, mode: '50/10', muted: true })
    expect(remaining(off, T0)).toBe(50 * MIN)
  })
})
