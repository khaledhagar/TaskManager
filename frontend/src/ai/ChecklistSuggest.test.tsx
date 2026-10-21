import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { ai } from '../api/ai'
import { ApiError } from '../api/client'
import { ChecklistSuggest } from './ChecklistSuggest'

vi.mock('../api/ai', () => ({ ai: { suggestChecklist: vi.fn() } }))

const addItem = vi.fn()

/** A request that stays open until resolved, and records its abort signal. */
function pending() {
  let resolve!: (value: { items: string[] }) => void
  let signal: AbortSignal | undefined
  vi.mocked(ai.suggestChecklist).mockImplementation((_id, s) => {
    signal = s
    return new Promise((r, reject) => {
      resolve = r
      s?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    })
  })
  return { resolve: (items: string[]) => resolve({ items }), signal: () => signal }
}

beforeEach(() => {
  vi.clearAllMocks()
  addItem.mockResolvedValue({})
})

describe('AI checklist suggestions (T-212)', () => {
  test('says the card text goes to an AI service', () => {
    render(<ChecklistSuggest cardId={7} onAdd={addItem} allowed={() => true} />)
    expect(screen.getByText(/third-party AI service/)).toBeInTheDocument()
  })

  test('shows a loading state, then adds only the selected suggestions in order', async () => {
    const request = pending()
    render(<ChecklistSuggest cardId={7} onAdd={addItem} allowed={() => true} />)
    await userEvent.click(screen.getByRole('button', { name: 'Suggest steps' }))
    expect(ai.suggestChecklist).toHaveBeenCalledWith(7, expect.any(AbortSignal))
    expect(screen.getByRole('status')).toHaveTextContent('Thinking...')

    request.resolve(['Draft outline', 'Write post', 'Publish'])
    const write = await screen.findByRole('checkbox', { name: 'Write post' })
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
    expect(write).toBeChecked()
    await userEvent.click(write)
    await userEvent.click(screen.getByRole('button', { name: 'Add 2 steps' }))

    expect(addItem.mock.calls).toEqual([['Draft outline'], ['Publish']])
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  test('Discard drops the suggestions without adding anything', async () => {
    vi.mocked(ai.suggestChecklist).mockResolvedValue({ items: ['One'] })
    render(<ChecklistSuggest cardId={7} onAdd={addItem} allowed={() => true} />)
    await userEvent.click(screen.getByRole('button', { name: 'Suggest steps' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Discard' }))
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(addItem).not.toHaveBeenCalled()
  })

  test('Cancel stops the request', async () => {
    const request = pending()
    render(<ChecklistSuggest cardId={7} onAdd={addItem} allowed={() => true} />)
    await userEvent.click(screen.getByRole('button', { name: 'Suggest steps' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(request.signal()?.aborted).toBe(true)
    expect(screen.getByRole('button', { name: 'Suggest steps' })).toBeEnabled()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  test('a failed request shows the server message', async () => {
    vi.mocked(ai.suggestChecklist).mockRejectedValue(new ApiError(429, 'AI limit reached'))
    render(<ChecklistSuggest cardId={7} onAdd={addItem} allowed={() => true} />)
    await userEvent.click(screen.getByRole('button', { name: 'Suggest steps' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('AI limit reached')
  })
})
