import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ai } from '../api/ai'
import { boards, type Board } from '../api/boards'
import { FakeRecognition, installFakeSpeech, removeFakeSpeech } from '../test/fakeSpeech'
import { ToastProvider } from '../ui/Toast'
import { BoardView } from './BoardView'

vi.mock('../api/boards', () => ({
  boards: { get: vi.fn(), addCard: vi.fn(), moveCard: vi.fn(async () => ({})) },
}))
vi.mock('../api/ai', () => ({ ai: { chat: vi.fn(async () => ({ reply: 'Two cards are due this week.', actions: [] })) } }))

const sample = (): Board => ({
  id: 1, title: 'Launch', role: 'admin', public: false, public_link: null, meeting_url: null, labels: [], members: [],
  background: { kind: 'none', preset: null, version: 0 },
  columns: [
    { id: 10, title: 'To Do', position: 0, cards: [] },
    { id: 12, title: 'Done', position: 1, cards: [] },
  ],
})

beforeEach(() => {
  vi.clearAllMocks()
  installFakeSpeech()
  vi.mocked(boards.get).mockResolvedValue(sample())
  vi.mocked(boards.addCard).mockResolvedValue({
    id: 5, title: 'Buy domain', details: '', completed: false, priority: 'medium', due_date: null, position: 0,
    label_ids: [], checklist: [], attachments: [], assignee_ids: [],
  })
})
afterEach(removeFakeSpeech)

async function renderBoard() {
  render(
    <ToastProvider>
      <BoardView boardId={1} userId={1} isGuest={false} onRenamed={vi.fn()} onDeleted={vi.fn()} />
    </ToastProvider>,
  )
  await screen.findByRole('heading', { name: 'Launch', level: 1 })
}

describe('voice commands on the board (T-788, T-789)', () => {
  test('V opens the window; a confirmed command adds the card through the board', async () => {
    await renderBoard()
    await userEvent.keyboard('v')
    const dialog = screen.getByRole('dialog', { name: 'Voice command' })
    act(() => FakeRecognition.last!.say('add card Buy domain to Done'))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }))
    expect(boards.addCard).toHaveBeenCalledWith(12, 'Buy domain')
    expect(await screen.findByRole('button', { name: /^Buy domain/ })).toBeInTheDocument()
  })

  test('a phrase it does not understand opens the AI chat and sends it', async () => {
    await renderBoard()
    await userEvent.click(screen.getByRole('button', { name: 'Voice command' }))
    act(() => FakeRecognition.last!.say('what is due this week'))
    expect(ai.chat).toHaveBeenCalledWith(1, [{ role: 'user', content: 'what is due this week' }], expect.any(AbortSignal))
    expect(await screen.findByText('Two cards are due this week.')).toBeInTheDocument()
  })
})
