import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { boards, type Board } from '../api/boards'
import { noticeLink, noticeText } from '../shell/notices'
import { Dialog } from '../ui/Dialog'
import { ToastProvider } from '../ui/Toast'
import { useToast } from '../ui/toastContext'
import { BoardView } from './BoardView'

vi.mock('../api/boards', () => ({
  boards: {
    get: vi.fn(),
    reorderColumns: vi.fn(async () => undefined),
    archiveColumn: vi.fn(async () => undefined),
    restoreColumn: vi.fn(async () => ({})),
  },
}))

const sample = (): Board => ({
  id: 1,
  title: 'Launch',
  background: { kind: 'none', preset: null, version: 0 },
  role: 'admin',
  public: false,
  public_link: null,
  meeting_url: null,
  members: [],
  labels: [],
  columns: [
    { id: 1, title: 'To Do', position: 0, cards: [] },
    { id: 2, title: 'Doing', position: 1, cards: [] },
    { id: 3, title: 'Done', position: 2, cards: [] },
  ],
})

async function renderBoard() {
  vi.mocked(boards.get).mockResolvedValue(sample())
  render(
    <ToastProvider>
      <BoardView boardId={1} userId={1} isGuest={false} onRenamed={vi.fn()} onDeleted={vi.fn()} />
    </ToastProvider>,
  )
  await screen.findByRole('heading', { name: 'Launch', level: 1 })
}

const titles = () => screen.getAllByRole('region').map((r) => r.getAttribute('aria-label')).filter((n) => ['To Do', 'Doing', 'Done'].includes(n ?? ''))

async function columnMenu(column: string, item: string) {
  await userEvent.click(screen.getByRole('button', { name: `Column options: ${column}` }))
  await userEvent.click(screen.getByRole('menuitem', { name: item }))
}

beforeEach(() => {
  vi.clearAllMocks()
  document.documentElement.dir = 'ltr'
})

describe('fixes from the user check (T-750 to T-755)', () => {
  test('T-750 a toast shown while a dialog is open is inside the dialog, so it can be clicked', async () => {
    function Shows() {
      const toast = useToast()
      return (
        <Dialog open onClose={() => {}} title="Card">
          <button type="button" onClick={() => toast({ message: 'Saved', action: { label: 'Undo', onClick: () => {} } })}>
            Go
          </button>
        </Dialog>
      )
    }
    render(
      <ToastProvider>
        <Shows />
      </ToastProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Go' }))
    const dialog = screen.getByRole('dialog', { name: 'Card' })
    expect(within(dialog).getByText('Saved')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Undo' })).toBeInTheDocument()
  })

  test('T-752 Move left and Move right in the column menu reorder the columns', async () => {
    await renderBoard()
    await userEvent.click(screen.getByRole('button', { name: 'Column options: To Do' }))
    expect(screen.queryByRole('menuitem', { name: 'Move left' })).toBeNull()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Move right' }))
    expect(titles()).toEqual(['Doing', 'To Do', 'Done'])
    expect(boards.reorderColumns).toHaveBeenCalledWith(1, [2, 1, 3])
    await columnMenu('Done', 'Move left')
    expect(boards.reorderColumns).toHaveBeenLastCalledWith(1, [2, 3, 1])
  })

  test('T-752 in Arabic (right to left) Move left goes later in the order', async () => {
    document.documentElement.dir = 'rtl'
    await renderBoard()
    await columnMenu('To Do', 'Move left')
    expect(boards.reorderColumns).toHaveBeenCalledWith(1, [2, 1, 3])
  })

  test('T-754 a column can be archived from its menu, with Undo', async () => {
    await renderBoard()
    await columnMenu('Doing', 'Archive column')
    expect(titles()).toEqual(['To Do', 'Done'])
    expect(boards.archiveColumn).toHaveBeenCalledWith(2)
    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }))
    expect(boards.restoreColumn).toHaveBeenCalledWith(2)
  })

  test('T-755 board options is the bold "..." icon (named for screen readers); Share is a labeled button', async () => {
    await renderBoard()
    const options = screen.getByRole('button', { name: 'Board options' })
    expect(options).toHaveTextContent('')
    expect(options.querySelector('svg')).toHaveAttribute('stroke-width', '3')
    const share = screen.getByRole('button', { name: 'Share' })
    expect(share).toHaveTextContent('Share')
    await userEvent.click(share)
    expect(screen.getByRole('dialog', { name: /^Members of/ })).toBeInTheDocument()
  })

  test('T-741 T-742 notification sentences and where they lead', () => {
    const base = { id: 1, board_id: 4, card_id: 9, actor_email: 'bob@example.com', created_at: '', read: false }
    const moved = { ...base, kind: 'card_changed' as const, data: { title: 'Fix', board: 'Launch', change: 'card.moved' } }
    expect(noticeText(moved)).toBe('bob@example.com moved "Fix" on Launch')
    expect(noticeLink(moved)).toBe('/?board=4&card=9')
    const other = { ...moved, data: { ...moved.data, change: 'checklist.checked' } }
    expect(noticeText(other)).toBe('bob@example.com changed "Fix" on Launch')
    const invite = { ...base, card_id: null, kind: 'invited' as const, data: { board: 'Launch', path: '/invite#token=x' } }
    expect(noticeText(invite)).toBe('bob@example.com invited you to the board "Launch"')
    expect(noticeLink(invite)).toBe('/invite#token=x')
  })
})
