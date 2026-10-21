import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { FocusTimer } from './FocusTimer'
import { playChime } from './sound'

vi.mock('./sound', () => ({ playChime: vi.fn() }))

const MIN = 60_000
const user = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  document.title = 'Task Manager'
})
afterEach(() => vi.useRealTimers())

async function turnOn() {
  await user().click(screen.getByRole('button', { name: 'Focus timer' }))
  return screen.getByRole('dialog', { name: 'Focus timer' })
}

describe('opt-in focus timer (T-231)', () => {
  test('off by default: only the Focus timer button shows', () => {
    render(<FocusTimer />)
    expect(screen.getByRole('button', { name: 'Focus timer' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText('25:00')).toBeNull()
  })

  test('turning it on opens the panel; turning it off stops, clears and hides it', async () => {
    render(<FocusTimer />)
    const panel = await turnOn()
    await user().click(within(panel).getByRole('button', { name: 'Start focus' }))
    await act(() => vi.advanceTimersByTime(3 * MIN))
    await user().click(within(panel).getByRole('button', { name: 'Turn off focus timer' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: 'Focus timer' })).toBeInTheDocument()
    expect(document.title).toBe('Task Manager')
    await act(() => vi.advanceTimersByTime(30 * MIN))
    expect(playChime).not.toHaveBeenCalled()
  })

  test('the choice and a running timer survive a reload', async () => {
    const first = render(<FocusTimer />)
    const panel = await turnOn()
    await user().click(within(panel).getByRole('button', { name: 'Start focus' }))
    await act(() => vi.advanceTimersByTime(5 * MIN))
    first.unmount()
    render(<FocusTimer />)
    expect(screen.getByRole('button', { name: /focus timer: 20:00 focus/i })).toBeInTheDocument()
  })
})

describe('timer display and alerts (T-230)', () => {
  test('tab title shows the time left while running', async () => {
    render(<FocusTimer />)
    const panel = await turnOn()
    await user().click(within(panel).getByRole('button', { name: 'Start focus' }))
    expect(document.title).toBe('25:00 Focus - Task Manager')
    await act(() => vi.advanceTimersByTime(MIN))
    expect(document.title).toBe('24:00 Focus - Task Manager')
  })

  test('phase change chimes and is announced once', async () => {
    render(<FocusTimer />)
    const panel = await turnOn()
    await user().click(within(panel).getByRole('button', { name: 'Start focus' }))
    await act(() => vi.advanceTimersByTime(25 * MIN + 1000))
    expect(playChime).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Focus time is over. Take a 5-minute break.')).toBeInTheDocument()
    expect(within(panel).getByText('Break')).toBeInTheDocument()
    await act(() => vi.advanceTimersByTime(MIN))
    expect(playChime).toHaveBeenCalledTimes(1)
  })

  test('muted timers do not chime', async () => {
    render(<FocusTimer />)
    const panel = await turnOn()
    await user().click(within(panel).getByRole('checkbox', { name: 'Sound when a phase ends' }))
    await user().click(within(panel).getByRole('button', { name: 'Start focus' }))
    await act(() => vi.advanceTimersByTime(26 * MIN))
    expect(playChime).not.toHaveBeenCalled()
  })

  test('reset buttons are only active in their own phase; mode switch works', async () => {
    render(<FocusTimer />)
    const panel = await turnOn()
    expect(within(panel).getByRole('button', { name: 'Reset focus' })).toBeEnabled()
    expect(within(panel).getByRole('button', { name: 'Reset break' })).toBeDisabled()
    await user().click(within(panel).getByRole('button', { name: 'Skip to break' }))
    expect(within(panel).getByRole('button', { name: 'Reset focus' })).toBeDisabled()
    expect(within(panel).getByRole('button', { name: 'Reset break' })).toBeEnabled()
    await user().click(within(panel).getByRole('button', { name: /50 min focus/ }))
    expect(within(panel).getByText('50:00')).toBeInTheDocument()
  })

  test('break end waits for the user', async () => {
    render(<FocusTimer />)
    const panel = await turnOn()
    await user().click(within(panel).getByRole('button', { name: 'Start focus' }))
    await act(() => vi.advanceTimersByTime(25 * MIN + 1000))
    await act(() => vi.advanceTimersByTime(5 * MIN + 1000))
    expect(within(panel).getByText(/break is over/i)).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Start focus' })).toBeInTheDocument()
  })
})

describe('focus sessions on a card (T-696)', () => {
  test('a finished focus period is reported for the chosen card', async () => {
    const done = vi.fn()
    render(<FocusTimer cards={[{ id: 4, title: 'Fix bug' }]} onFocusDone={done} />)
    const panel = await turnOn()
    await user().selectOptions(within(panel).getByLabelText('Focus on a card'), 'Fix bug')
    await user().click(within(panel).getByRole('button', { name: 'Start focus' }))
    await act(() => vi.advanceTimersByTime(25 * MIN + 1000))
    expect(done).toHaveBeenCalledTimes(1)
    expect(done).toHaveBeenCalledWith(4, 25)
  })

  test('without a chosen card nothing is saved; viewers get no card list', async () => {
    const done = vi.fn()
    const first = render(<FocusTimer cards={[{ id: 4, title: 'Fix bug' }]} onFocusDone={done} />)
    const panel = await turnOn()
    await user().click(within(panel).getByRole('button', { name: 'Start focus' }))
    await act(() => vi.advanceTimersByTime(25 * MIN + 1000))
    expect(done).not.toHaveBeenCalled()
    first.unmount()
    render(<FocusTimer cards={[]} onFocusDone={done} />)
    expect(screen.queryByLabelText('Focus on a card')).toBeNull()
  })
})
