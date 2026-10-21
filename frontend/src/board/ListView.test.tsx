import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { boards, type Board, type Card } from '../api/boards'
import { ToastProvider } from '../ui/Toast'
import { BoardView } from './BoardView'

vi.mock('../api/boards', () => ({ boards: { get: vi.fn() } }))
vi.mock('../api/collab', () => ({ collab: { comments: vi.fn(async () => []), activity: vi.fn(async () => []) } }))
vi.mock('../api/files', () => ({ files: { usage: vi.fn(async () => ({ used: 0, limit: 1 })), url: () => '' } }))

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

const sample: Board = {
  id: 1,
  title: 'Launch',
  background: { kind: 'none', preset: null, version: 0 },
  role: 'admin',
  public: false,
  public_link: null,
  meeting_url: null,
  members: [{ user_id: 1, email: 'ann@example.com' }],
  labels: [{ id: 5, name: 'Bug', color: 'red' }],
  columns: [
    { id: 1, title: 'To Do', position: 0, cards: [card(1, 'Write post', { priority: 'low' }), card(2, 'Fix bug', { priority: 'urgent', label_ids: [5], assignee_ids: [1] })] },
    { id: 2, title: 'Done', position: 1, cards: [card(3, 'Pick colors', { completed: true, due_date: '2026-10-30' })] },
  ],
}

async function renderBoard() {
  vi.mocked(boards.get).mockResolvedValue(sample)
  render(
    <ToastProvider>
      <BoardView boardId={1} userId={1} isGuest={false} onRenamed={vi.fn()} onDeleted={vi.fn()} />
    </ToastProvider>,
  )
  await screen.findByRole('heading', { name: 'Launch', level: 1 })
}

const titles = () =>
  within(screen.getByRole('region', { name: 'Cards on Launch' }))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].textContent)

beforeEach(() => {
  vi.clearAllMocks()
  history.replaceState(null, '', '/?board=1')
})

describe('list view (T-700, T-701)', () => {
  test('the Board / List switch is kept in the URL', async () => {
    await renderBoard()
    const views = screen.getByRole('group', { name: 'View' })
    expect(within(views).getByRole('button', { name: 'Board' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(within(views).getByRole('button', { name: 'List' }))
    expect(location.search).toBe('?board=1&view=list')
    expect(screen.queryByRole('region', { name: 'To Do' })).toBeNull()
    await userEvent.click(within(views).getByRole('button', { name: 'Board' }))
    expect(location.search).toBe('?board=1')
  })

  test('opens straight in the list from a link', async () => {
    history.replaceState(null, '', '/?board=1&view=list')
    await renderBoard()
    expect(titles()).toEqual(['Write post', 'Fix bug', 'Pick colors'])
    const fix = screen.getAllByRole('row')[2]
    expect(fix).toHaveTextContent('To Do')
    expect(fix).toHaveTextContent('Urgent')
    expect(fix).toHaveTextContent('ann@example.com')
    expect(fix).toHaveTextContent('Bug')
    expect(screen.getAllByRole('row')[3]).toHaveTextContent('Done')
  })

  test('sorts by a column header, both ways', async () => {
    history.replaceState(null, '', '/?board=1&view=list')
    await renderBoard()
    await userEvent.click(screen.getByRole('button', { name: 'Title' }))
    expect(titles()).toEqual(['Fix bug', 'Pick colors', 'Write post'])
    expect(screen.getByRole('columnheader', { name: /Title/ })).toHaveAttribute('aria-sort', 'ascending')
    await userEvent.click(screen.getByRole('button', { name: 'Title' }))
    expect(titles()).toEqual(['Write post', 'Pick colors', 'Fix bug'])
    await userEvent.click(screen.getByRole('button', { name: 'Priority' }))
    expect(titles()).toEqual(['Fix bug', 'Pick colors', 'Write post'])
  })

  test('follows the filters and opens a card', async () => {
    history.replaceState(null, '', '/?board=1&view=list')
    await renderBoard()
    await userEvent.type(screen.getByRole('searchbox'), 'fix')
    expect(titles()).toEqual(['Fix bug'])
    await userEvent.click(screen.getByRole('button', { name: 'Fix bug' }))
    expect(screen.getByRole('dialog', { name: 'Fix bug' })).toBeInTheDocument()
  })

  test('shows all 100 cards of a full board (speed is measured in the browser, T-713)', async () => {
    const many = Array.from({ length: 100 }, (_, i) => card(100 + i, `Card ${i}`))
    vi.mocked(boards.get).mockResolvedValue({ ...sample, columns: [{ ...sample.columns[0], cards: many }] })
    history.replaceState(null, '', '/?board=1&view=list')
    render(
      <ToastProvider>
        <BoardView boardId={1} userId={1} isGuest={false} onRenamed={vi.fn()} onDeleted={vi.fn()} />
      </ToastProvider>,
    )
    await screen.findByRole('heading', { name: 'Launch', level: 1 })
    await userEvent.click(screen.getByRole('button', { name: 'Title' }))
    expect(screen.getAllByRole('row')).toHaveLength(101)
  })
})
