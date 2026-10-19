import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { useShortcuts } from './useShortcuts'

function Harness({ handlers }: { handlers: Record<string, () => void> }) {
  useShortcuts(handlers)
  return (
    <div>
      <input aria-label="Search" />
      <button type="button">Other</button>
    </div>
  )
}

describe('keyboard shortcuts (T-211)', () => {
  test('N, / and ? call their handlers', async () => {
    const handlers = { n: vi.fn(), '/': vi.fn(), '?': vi.fn() }
    render(<Harness handlers={handlers} />)
    await userEvent.keyboard('n/?')
    expect(handlers.n).toHaveBeenCalledTimes(1)
    expect(handlers['/']).toHaveBeenCalledTimes(1)
    expect(handlers['?']).toHaveBeenCalledTimes(1)
  })

  test('ignored while typing in a field', async () => {
    const handlers = { n: vi.fn() }
    render(<Harness handlers={handlers} />)
    await userEvent.type(screen.getByLabelText('Search'), 'new')
    expect(handlers.n).not.toHaveBeenCalled()
  })

  test('ignored with modifier keys', async () => {
    const handlers = { n: vi.fn() }
    render(<Harness handlers={handlers} />)
    await userEvent.keyboard('{Control>}n{/Control}')
    expect(handlers.n).not.toHaveBeenCalled()
  })

  test('ignored while a dialog is open', async () => {
    const handlers = { n: vi.fn() }
    render(<Harness handlers={handlers} />)
    const dialog = document.createElement('dialog')
    dialog.setAttribute('open', '')
    document.body.append(dialog)
    await userEvent.keyboard('n')
    expect(handlers.n).not.toHaveBeenCalled()
    dialog.remove()
  })
})
