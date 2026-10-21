import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { Board, Card, Role } from '../api/boards'
import { I18nProvider } from '../i18n/I18n'
import { applyLanguage } from '../i18n/language'
import { FakeRecognition, installFakeSpeech, removeFakeSpeech } from '../test/fakeSpeech'
import { ToastProvider } from '../ui/Toast'
import { VoiceCommand } from './VoiceCommand'

const card = (id: number, title: string): Card => ({
  id, title, details: '', completed: false, priority: 'medium', due_date: null, position: 0,
  label_ids: [], checklist: [], attachments: [], assignee_ids: [],
})

const board = (role: Role = 'admin'): Board => ({
  id: 1, title: 'Launch', role, public: false, public_link: null, meeting_url: null, labels: [],
  background: { kind: 'none', preset: null, version: 0 },
  members: [{ user_id: 1, email: 'ann@example.com' }],
  columns: [
    { id: 10, title: 'To Do', position: 0, cards: [card(1, 'Buy domain'), card(2, 'Design page'), card(3, 'Design logo')] },
    { id: 12, title: 'Done', position: 1, cards: [] },
  ],
})

const handlers = { onChange: vi.fn(), onLookup: vi.fn(), onAskAi: vi.fn() }

function Harness({ b = board(), startPage = false }: { b?: Board; startPage?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <I18nProvider>
    <ToastProvider>
      <VoiceCommand
        open={open}
        onOpenChange={setOpen}
        board={startPage ? null : b}
        boards={[{ id: 2, title: 'Marketing', created_at: '', role: 'admin' }]}
        me={1}
        {...handlers}
        onAskAi={startPage ? undefined : handlers.onAskAi}
        buttonClassName=""
        labelClassName=""
      />
    </ToastProvider>
    </I18nProvider>
  )
}

async function say(text: string) {
  act(() => FakeRecognition.last!.say(text))
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  applyLanguage('en')
  installFakeSpeech()
})
afterEach(removeFakeSpeech)

const dialog = () => screen.getByRole('dialog', { name: 'Voice command' })

describe('voice command window (T-784 to T-788)', () => {
  test('opening listens; a change is shown and done only after Confirm', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Voice command' }))
    expect(FakeRecognition.last!.started).toBe(true)
    expect(within(dialog()).getByText('Listening. Say a command.')).toBeInTheDocument()
    await say('add card Buy hosting to Done')
    expect(within(dialog()).getByText('Add card "Buy hosting" to Done')).toBeInTheDocument()
    expect(handlers.onChange).not.toHaveBeenCalled()
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Confirm' }))
    expect(handlers.onChange).toHaveBeenCalledWith({ type: 'add', title: 'Buy hosting', columnId: 12 })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('Done: Add card "Buy hosting" to Done')).toBeInTheDocument()
  })

  test('Cancel does nothing', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Voice command' }))
    await say('delete buy domain')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    expect(handlers.onChange).not.toHaveBeenCalled()
    expect(within(dialog()).queryByText('Delete "Buy domain"')).toBeNull()
  })

  test('look-ups happen at once and close the window', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Voice command' }))
    await say('show overdue')
    expect(handlers.onLookup).toHaveBeenCalledWith({ type: 'filter', filters: { status: 'overdue', assignee: null } })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('several matches are offered; the chosen one is shown for Confirm', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Voice command' }))
    await say('move design to done')
    const choices = within(dialog()).getByRole('group', { name: 'Which one did you mean?' })
    await userEvent.click(within(choices).getByRole('button', { name: 'Design logo' }))
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Confirm' }))
    expect(handlers.onChange).toHaveBeenCalledWith({ type: 'move', cardId: 3, columnId: 12 })
  })

  test('commands obey the board role, like the buttons (SEC-218)', async () => {
    const { unmount } = render(<Harness b={board('viewer')} />)
    await userEvent.click(screen.getByRole('button', { name: 'Voice command' }))
    await say('move buy domain to done')
    expect(within(dialog()).getByText(/You can only view this board/)).toBeInTheDocument()
    expect(within(dialog()).queryByRole('button', { name: 'Confirm' })).toBeNull()
    unmount()
    render(<Harness b={board('updater')} />)
    await userEvent.click(screen.getByRole('button', { name: 'Voice command' }))
    await say('rename buy domain to Buy it')
    expect(within(dialog()).getByText(/Ask the board admin for full access/)).toBeInTheDocument()
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Listen again' }))
    await say('complete buy domain')
    expect(within(dialog()).getByRole('button', { name: 'Confirm' })).toBeInTheDocument()
  })

  test('longer phrases it does not understand go to the AI; one word does not (SEC-219)', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Voice command' }))
    await say('banana')
    expect(handlers.onAskAi).not.toHaveBeenCalled()
    expect(within(dialog()).getByText("Sorry, I didn't understand that.")).toBeInTheDocument()
    expect(within(dialog()).getByRole('region', { name: 'What can I say?' })).toBeInTheDocument()
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Listen again' }))
    await say('what is due this week')
    expect(handlers.onAskAi).toHaveBeenCalledWith('what is due this week')
  })

  test('a command can be typed, without a microphone', async () => {
    removeFakeSpeech()
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Voice command' }))
    expect(within(dialog()).queryByRole('button', { name: 'Listen again' })).toBeNull()
    await userEvent.type(within(dialog()).getByLabelText('Or type a command'), 'complete buy domain{Enter}')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Confirm' }))
    expect(handlers.onChange).toHaveBeenCalledWith({ type: 'complete', cardId: 1, done: true })
  })

  test('help lists the commands; the start page only opens boards', async () => {
    render(<Harness startPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Voice command' }))
    await say('what can I say')
    expect(within(dialog()).getByText('add card Buy domain to To Do')).toBeInTheDocument()
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Listen again' }))
    await say('move buy domain to done')
    expect(within(dialog()).getByText('Open a board first to do that.')).toBeInTheDocument()
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Listen again' }))
    await say('open board marketing')
    expect(handlers.onLookup).toHaveBeenCalledWith({ type: 'openBoard', boardId: 2 })
  })

  test('Arabic: listens in Arabic and shows the sentence in Arabic', async () => {
    localStorage.setItem('language', 'ar')
    applyLanguage('ar')
    const b = board()
    b.columns[1].title = 'تم'
    render(<Harness b={b} />)
    await userEvent.click(screen.getByRole('button', { name: 'أمر صوتي' }))
    expect(FakeRecognition.last!.lang).toBe('ar-EG')
    await say('انقل Buy domain إلى تم')
    expect(screen.getByText('نقل "Buy domain" إلى تم')).toBeInTheDocument()
  })
})
