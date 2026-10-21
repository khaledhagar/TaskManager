import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { boards, type Board, type Role } from '../api/boards'
import { sharing } from '../api/sharing'
import { BoardView } from '../board/BoardView'
import { ToastProvider } from '../ui/Toast'

vi.mock('../api/boards', () => ({
  boards: { get: vi.fn(), addCard: vi.fn(), updateCard: vi.fn(), moveCard: vi.fn(), removeCard: vi.fn() },
}))
vi.mock('../api/sharing', () => ({ sharing: { requestAccess: vi.fn(), members: vi.fn() } }))

const card = (id: number, title: string) => ({
  id, title, details: '', completed: false, priority: 'medium' as const, due_date: null,
  position: 0, label_ids: [], checklist: [], attachments: [],
})

const board = (role: Role): Board => ({
  id: 1,
  title: 'Shared plan',
  background: { kind: 'none', preset: null, version: 0 },
  labels: [],
  columns: [{ id: 1, title: 'To Do', position: 0, cards: [card(1, 'Write announcement')] }],
  role,
})

function renderAs(role: Role) {
  vi.mocked(boards.get).mockResolvedValue(board(role))
  render(
    <ToastProvider>
      <BoardView boardId={1} userId={2} isGuest={false} onRenamed={vi.fn()} onDeleted={vi.fn()} />
    </ToastProvider>,
  )
}

const VIEW_ONLY = 'You can only view this board. Ask the board admin for permission to edit.'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(sharing.requestAccess).mockResolvedValue({ id: 9 })
})

describe('board follows the member role (T-546 to T-548)', () => {
  test('a viewer adding a card sees "ask the admin"; nothing is sent; Request access sends once', async () => {
    renderAs('viewer')
    await screen.findByText('Write announcement')
    await userEvent.click(screen.getByRole('button', { name: 'Add card' }))
    await userEvent.type(screen.getByLabelText('New card title'), 'One more{Enter}')
    expect(await screen.findByText(VIEW_ONLY)).toBeInTheDocument()
    expect(boards.addCard).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Request access' }))
    expect(sharing.requestAccess).toHaveBeenCalledWith(1)
    expect(await screen.findByText('Request sent. The board admin will get an email.')).toBeInTheDocument()
  })

  test('a viewer cannot complete a card', async () => {
    renderAs('viewer')
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Completed: Write announcement' }))
    expect(await screen.findByText(VIEW_ONLY)).toBeInTheDocument()
    expect(boards.updateCard).not.toHaveBeenCalled()
    expect(screen.getByRole('checkbox', { name: 'Completed: Write announcement' })).not.toBeChecked()
  })

  test('"Can update tasks" completes cards but cannot delete them', async () => {
    vi.mocked(boards.updateCard).mockResolvedValue({ ...card(1, 'Write announcement'), completed: true })
    renderAs('updater')
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Completed: Write announcement' }))
    expect(boards.updateCard).toHaveBeenCalledWith(1, { completed: true })
    await userEvent.click(screen.getByRole('button', { name: /write announcement/i }))
    const dialog = screen.getByRole('dialog', { name: 'Write announcement' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete card' }))
    expect(await screen.findByText('Ask the board admin for full access to do this.')).toBeInTheDocument()
    expect(screen.getByText('Write announcement', { selector: 'h2, button *, button' })).toBeInTheDocument()
  })

  test('only the admin sees background and delete in the board menu; everyone sees Members', async () => {
    renderAs('editor')
    await screen.findByText('Write announcement')
    await userEvent.click(screen.getByRole('button', { name: 'Board options' }))
    expect(screen.getByRole('menuitem', { name: 'Members' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Change background' })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: 'Delete board' })).toBeNull()
  })

  test('renaming the board as a member says only the admin can', async () => {
    const onRenamed = vi.fn()
    vi.mocked(boards.get).mockResolvedValue(board('editor'))
    render(
      <ToastProvider>
        <BoardView boardId={1} userId={2} isGuest={false} onRenamed={onRenamed} onDeleted={vi.fn()} />
      </ToastProvider>,
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Shared plan' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Rename board Shared plan' }), ' 2{Enter}')
    expect(await screen.findByText('Only the board admin can do this.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Request access' })).toBeNull()
    expect(onRenamed).not.toHaveBeenCalled()
  })

  test('the board reloads when the tab regains focus (T-550)', async () => {
    renderAs('viewer')
    await screen.findByText('Write announcement')
    window.dispatchEvent(new Event('focus'))
    await vi.waitFor(() => expect(boards.get).toHaveBeenCalledTimes(2))
  })
})
