import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ai, type ChatAction } from '../api/ai'
import type { Board } from '../api/boards'
import { ApiError } from '../api/client'
import type { BoardActions } from '../board/useBoard'
import { ChatPanel } from './ChatPanel'

vi.mock('../api/ai', () => ({ ai: { chat: vi.fn() } }))

const card = (id: number, title: string) => ({
  id, title, details: '', completed: false, priority: 'medium' as const, due_date: null,
  position: 0, label_ids: [], checklist: [], attachments: [],
})
const board: Board = {
  id: 5,
  title: 'Launch',
  labels: [],
  background: { kind: 'none', preset: null, version: 0 }, role: 'admin' as const,
  columns: [
    { id: 1, title: 'To Do', position: 0, cards: [card(10, 'Write post'), card(11, 'Set up analytics')] },
    { id: 2, title: 'Done', position: 1, cards: [card(12, 'Pick colors')] },
  ],
}
const action = (a: Partial<ChatAction>): ChatAction => ({
  type: 'create_card', card_id: null, column_id: null, title: null, ...a,
})

let actions: BoardActions
const onClose = vi.fn()

function open() {
  render(<ChatPanel open board={board} actions={actions} onClose={onClose} />)
  return screen.getByRole('complementary', { name: 'AI assistant' })
}

async function send(text: string) {
  await userEvent.type(screen.getByLabelText('Message'), `${text}{Enter}`)
}

afterEach(() => {
  delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView
})

beforeEach(() => {
  vi.clearAllMocks()
  actions = { addCard: vi.fn(), moveCard: vi.fn(), updateCard: vi.fn() } as unknown as BoardActions
})

describe('chat panel (T-213)', () => {
  test('says what is sent to the AI service and how to start', () => {
    const panel = open()
    expect(within(panel).getByText(/third-party AI service/)).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Clear chat' })).toBeDisabled()
  })

  test('sends the message, shows a loading state, then the reply as plain text', async () => {
    let resolve!: (reply: { reply: string; actions: ChatAction[] }) => void
    vi.mocked(ai.chat).mockReturnValue(new Promise((r) => (resolve = r)))
    open()
    await send('What is left?')
    expect(ai.chat).toHaveBeenCalledWith(5, [{ role: 'user', content: 'What is left?' }], expect.any(AbortSignal))
    expect(screen.getByText('What is left?')).toBeInTheDocument()
    expect(screen.getByLabelText('Message')).toHaveValue('')
    expect(screen.getByRole('status')).toHaveTextContent('Thinking...')

    resolve({ reply: '<b>Two</b> cards are left.', actions: [] })
    expect(await screen.findByText('<b>Two</b> cards are left.')).toBeInTheDocument()
    expect(screen.queryByRole('status')).toBeNull()
  })

  test('earlier messages are sent with the next question', async () => {
    vi.mocked(ai.chat).mockResolvedValue({ reply: 'Two.', actions: [] })
    open()
    await send('How many cards?')
    await screen.findByText('Two.')
    await send('And done?')
    expect(vi.mocked(ai.chat).mock.calls[1][1]).toEqual([
      { role: 'user', content: 'How many cards?' },
      { role: 'assistant', content: 'Two.' },
      { role: 'user', content: 'And done?' },
    ])
  })

  test('keeps working where scrollIntoView returns a Promise (Edge 155)', async () => {
    const scroll = vi.fn(() => Promise.resolve())
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { value: scroll, configurable: true })
    vi.mocked(ai.chat).mockResolvedValue({ reply: 'Still here.', actions: [] })
    open()
    await send('Hi')
    expect(await screen.findByText('Still here.')).toBeInTheDocument()
    expect(scroll).toHaveBeenCalled()
  })

  test('Shift+Enter adds a new line instead of sending', async () => {
    open()
    await userEvent.type(screen.getByLabelText('Message'), 'one{Shift>}{Enter}{/Shift}two')
    expect(ai.chat).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Message')).toHaveValue('one\ntwo')
  })

  test('Cancel stops the request; errors are shown', async () => {
    let signal: AbortSignal | undefined
    vi.mocked(ai.chat).mockImplementationOnce((_b, _m, s) => {
      signal = s
      return new Promise((_r, reject) =>
        s?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))),
      )
    })
    open()
    await send('Hi')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel request' }))
    expect(signal?.aborted).toBe(true)
    expect(screen.queryByRole('alert')).toBeNull()

    vi.mocked(ai.chat).mockRejectedValueOnce(new ApiError(429, 'AI limit reached'))
    await send('Again')
    expect(await screen.findByRole('alert')).toHaveTextContent('AI limit reached')
  })

  test('Escape closes the panel', async () => {
    open()
    await userEvent.type(screen.getByLabelText('Message'), '{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  test('Clear removes the conversation', async () => {
    vi.mocked(ai.chat).mockResolvedValue({ reply: 'Hello.', actions: [] })
    open()
    await send('Hi')
    await screen.findByText('Hello.')
    await userEvent.click(screen.getByRole('button', { name: 'Clear chat' }))
    expect(screen.queryByText('Hello.')).toBeNull()
  })

  test('proposed actions are described with Confirm buttons; nothing changes before Confirm', async () => {
    vi.mocked(ai.chat).mockResolvedValue({
      reply: 'Here is my plan.',
      actions: [
        action({ type: 'create_card', column_id: 1, title: 'Draft FAQ' }),
        action({ type: 'move_card', card_id: 10, column_id: 2 }),
        action({ type: 'complete_card', card_id: 11 }),
      ],
    })
    open()
    await send('Tidy up')
    await screen.findByText('Here is my plan.')
    expect(screen.getByText('Create card "Draft FAQ" in To Do')).toBeInTheDocument()
    expect(screen.getByText('Move "Write post" to Done')).toBeInTheDocument()
    expect(screen.getByText('Mark "Set up analytics" as complete')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Confirm/ })).toHaveLength(3)
    expect(actions.addCard).not.toHaveBeenCalled()
  })

  test('an action whose card is gone cannot be confirmed', async () => {
    vi.mocked(ai.chat).mockResolvedValue({ reply: 'Ok.', actions: [action({ type: 'complete_card', card_id: 99 })] })
    open()
    await send('Finish it')
    expect(await screen.findByText('This change no longer fits the board.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Confirm/ })).toBeNull()
  })
})

describe('confirming chat actions (T-214)', () => {
  async function propose(...proposed: ChatAction[]) {
    vi.mocked(ai.chat).mockResolvedValue({ reply: 'Ok.', actions: proposed })
    open()
    await send('Do it')
    await screen.findByText('Ok.')
  }

  test('create_card adds the card to the column', async () => {
    await propose(action({ type: 'create_card', column_id: 2, title: 'Celebrate' }))
    await userEvent.click(screen.getByRole('button', { name: /^Confirm/ }))
    expect(actions.addCard).toHaveBeenCalledWith(2, 'Celebrate')
    expect(screen.getByText('Done')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Confirm/ })).toBeNull()
  })

  test('move_card moves the card to the end of the column', async () => {
    await propose(action({ type: 'move_card', card_id: 10, column_id: 2 }))
    await userEvent.click(screen.getByRole('button', { name: /^Confirm/ }))
    expect(actions.moveCard).toHaveBeenCalledWith(10, 2, 1)
  })

  test('complete_card marks the card complete', async () => {
    await propose(action({ type: 'complete_card', card_id: 11 }))
    await userEvent.click(screen.getByRole('button', { name: /^Confirm/ }))
    expect(actions.updateCard).toHaveBeenCalledWith(11, { completed: true })
  })

  test('Dismiss drops a proposal without changing the board', async () => {
    await propose(action({ type: 'complete_card', card_id: 11 }))
    await userEvent.click(screen.getByRole('button', { name: /^Dismiss/ }))
    expect(actions.updateCard).not.toHaveBeenCalled()
    expect(screen.getByText('Dismissed')).toBeInTheDocument()
  })
})
