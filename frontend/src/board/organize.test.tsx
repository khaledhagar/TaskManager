import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { boards, type Board, type Card } from '../api/boards'
import { templates } from '../api/templates'
import { ToastProvider } from '../ui/Toast'
import { BoardView } from './BoardView'

vi.mock('../api/boards', () => ({
  boards: {
    get: vi.fn(),
    archiveCard: vi.fn(async () => undefined),
    restoreCard: vi.fn(async () => ({})),
    removeCard: vi.fn(async () => undefined),
    duplicateCard: vi.fn(),
    archived: vi.fn(async () => []),
    setWipLimit: vi.fn(async () => ({})),
    setAutoComplete: vi.fn(async () => ({})),
    moveCard: vi.fn(async () => ({})),
    star: vi.fn(async () => undefined),
    archive: vi.fn(async () => ({})),
    restore: vi.fn(async () => ({})),
    duplicate: vi.fn(),
    setCover: vi.fn(async () => ({})),
  },
}))
vi.mock('../api/templates', () => ({ templates: { save: vi.fn(async () => ({ id: 1, name: 'Launch kit' })) } }))
vi.mock('../api/collab', () => ({ collab: { comments: vi.fn(async () => []), activity: vi.fn(async () => []) } }))
vi.mock('../api/files', () => ({ files: { usage: vi.fn(async () => ({ used: 0, limit: 1 })), url: (id: number) => `/f/${id}` } }))

const card = (id: number, title: string, extra: Partial<Card> = {}): Card => ({
  id,
  title,
  details: '',
  completed: false,
  priority: 'medium',
  due_date: null,
  position: 0,
  label_ids: [],
  checklist: [],
  attachments: [],
  assignee_ids: [],
  ...extra,
})

function sample(extra: Partial<Board> = {}): Board {
  return {
    id: 1,
    title: 'Launch',
    background: { kind: 'none', preset: null, version: 0 },
    role: 'admin',
    public: false,
    public_link: null,
    meeting_url: null,
    members: [],
    labels: [],
    auto_complete: false,
    archived: false,
    columns: [
      { id: 1, title: 'To Do', position: 0, wip_limit: 1, cards: [card(1, 'Write post'), card(2, 'Fix bug')] },
      { id: 2, title: 'Done', position: 1, wip_limit: null, cards: [] },
    ],
    ...extra,
  }
}

const onUpdated = vi.fn()
const onCreated = vi.fn()

async function renderBoard(board = sample(), starred = false) {
  vi.mocked(boards.get).mockResolvedValue(board)
  render(
    <ToastProvider>
      <BoardView boardId={1} userId={1} isGuest={false} starred={starred} onRenamed={vi.fn()} onDeleted={vi.fn()} onUpdated={onUpdated} onCreated={onCreated} />
    </ToastProvider>,
  )
  await screen.findByRole('heading', { name: 'Launch', level: 1 })
}

async function menu(item: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Board options' }))
  await userEvent.click(screen.getByRole('menuitem', { name: item }))
}

beforeEach(() => vi.clearAllMocks())

describe('archive and restore cards (T-680)', () => {
  test('archiving from the card window removes the card; Undo restores it', async () => {
    await renderBoard()
    await userEvent.click(screen.getByRole('button', { name: /Write post/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Archive' }))
    expect(screen.queryByRole('button', { name: /Write post/ })).toBeNull()
    expect(boards.archiveCard).toHaveBeenCalledWith(1)
    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }))
    expect(boards.restoreCard).toHaveBeenCalledWith(1)
  })

  test('the Archived cards panel restores a card or deletes it for good', async () => {
    vi.mocked(boards.archived).mockResolvedValue([
      { id: 9, title: 'Old idea', column_id: 1, column_title: 'To Do', archived_at: '2026-10-20T10:00:00Z' },
    ])
    await renderBoard()
    await menu('Archived cards')
    const panel = screen.getByRole('dialog', { name: 'Archived cards' })
    expect(await within(panel).findByText('From To Do')).toBeInTheDocument()
    await userEvent.click(within(panel).getByRole('button', { name: 'Restore Old idea' }))
    expect(boards.restoreCard).toHaveBeenCalledWith(9)
    await userEvent.click(within(panel).getByRole('button', { name: 'Delete Old idea' }))
    await userEvent.click(within(panel).getByRole('button', { name: 'Delete for good' }))
    expect(boards.removeCard).toHaveBeenCalledWith(9)
  })
})

describe('duplicate, templates, star and board archive (T-681 to T-685)', () => {
  test('Duplicate places the copy right after the original', async () => {
    vi.mocked(boards.duplicateCard).mockResolvedValue(card(5, 'Write post (copy)'))
    await renderBoard()
    await userEvent.click(screen.getByRole('button', { name: /Write post/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate' }))
    const todo = screen.getByRole('region', { name: 'To Do' })
    const titles = within(todo).getAllByRole('button', { name: /^(Write post|Fix bug)/ }).map((b) => b.textContent)
    expect(titles[1]).toMatch(/^Write post \(copy\)/)
  })

  test('Duplicate board and Save as template', async () => {
    vi.mocked(boards.duplicate).mockResolvedValue({ id: 2, title: 'Launch (copy)', created_at: '', role: 'admin' })
    await renderBoard()
    await menu('Duplicate board')
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 2 })))
    await menu('Save as template')
    const dialog = screen.getByRole('dialog', { name: 'Save as template' })
    await userEvent.clear(within(dialog).getByLabelText('Template name'))
    await userEvent.type(within(dialog).getByLabelText('Template name'), 'Launch kit')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(templates.save).toHaveBeenCalledWith(1, 'Launch kit')
    expect(await screen.findByText('Saved as template "Launch kit"')).toBeInTheDocument()
  })

  test('star toggles and is reported to the switcher', async () => {
    await renderBoard(sample(), false)
    const star = screen.getByRole('button', { name: 'Star board' })
    expect(star).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(star)
    expect(boards.star).toHaveBeenCalledWith(1, true)
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(1, { starred: true }))
  })

  test('the admin archives a board; an archived board says so and can be restored', async () => {
    await renderBoard()
    await menu('Archive board')
    expect(boards.archive).toHaveBeenCalledWith(1)
    expect(await screen.findByText('This board is archived.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Restore board' }))
    expect(boards.restore).toHaveBeenCalledWith(1)
  })

  test('board-level admin items are hidden from other roles', async () => {
    await renderBoard(sample({ role: 'editor' }))
    await userEvent.click(screen.getByRole('button', { name: 'Board options' }))
    expect(screen.getByRole('menuitem', { name: 'Duplicate board' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Archive board' })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: /Auto-complete/ })).toBeNull()
  })
})

describe('WIP limits and auto-complete (T-686, T-687)', () => {
  test('a column over its limit shows the count against the limit as a warning', async () => {
    await renderBoard()
    const count = screen.getByLabelText('2 cards, over the limit of 1')
    expect(count).toHaveTextContent('2 of 1')
    expect(count).toHaveAttribute('data-over')
  })

  test('the WIP limit is set from the column menu', async () => {
    await renderBoard()
    await userEvent.click(screen.getByRole('button', { name: 'Column options: Done' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Set WIP limit' }))
    const dialog = screen.getByRole('dialog', { name: 'Work in progress limit' })
    const input = within(dialog).getByLabelText('Most cards in "Done"')
    await userEvent.type(input, '0')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(within(dialog).getByText('Enter a number from 1 to 100.')).toBeInTheDocument()
    await userEvent.clear(input)
    await userEvent.type(input, '3')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(boards.setWipLimit).toHaveBeenCalledWith(2, 3)
    expect(screen.getByLabelText('0 cards')).toHaveTextContent('0 of 3')
  })

  test('the admin turns auto-complete on from the board menu', async () => {
    await renderBoard()
    await menu('Auto-complete: off')
    expect(boards.setAutoComplete).toHaveBeenCalledWith(1, true)
    expect(await screen.findByText('Cards moved into the last column are now marked complete.')).toBeInTheDocument()
  })
})

describe('cover and focus stats on the card (T-688, T-696)', () => {
  test('the card face shows its cover and focus time', async () => {
    const covered = card(1, 'Write post', {
      cover_attachment_id: 4,
      focus_count: 3,
      focus_minutes: 75,
      attachments: [{ id: 4, filename: 'a.png', content_type: 'image/png', size: 1, is_image: true, created_at: '' }],
    })
    await renderBoard(sample({ columns: [{ id: 1, title: 'To Do', position: 0, cards: [covered] }] }))
    const face = screen.getByRole('button', { name: /Write post/ })
    expect(face.querySelector('img')).toHaveAttribute('src', '/f/4')
    expect(face).toHaveTextContent('3 focus sessions, 75 min')
    await userEvent.click(face)
    await userEvent.click(screen.getByRole('button', { name: 'Remove cover: a.png' }))
    expect(boards.setCover).toHaveBeenCalledWith(1, null)
  })
})
