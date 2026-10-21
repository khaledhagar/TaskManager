import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { boards, type Board } from '../api/boards'
import { ToastProvider } from '../ui/Toast'
import { BoardView } from './BoardView'

vi.mock('../api/boards', () => ({
  boards: {
    get: vi.fn(),
    addCard: vi.fn(),
    renameColumn: vi.fn(),
    updateCard: vi.fn(),
    rename: vi.fn(),
    addColumn: vi.fn(),
  },
}))

const card = (id: number, title: string, extra = {}) => ({
  id,
  title,
  details: '',
  completed: false,
  priority: 'medium' as const,
  due_date: null,
  position: 0,
  label_ids: [] as number[],
  checklist: [],
  attachments: [],
  ...extra,
})

function sample(): Board {
  return {
    id: 1,
    title: 'Website Launch',
    background: { kind: 'none' as const, preset: null, version: 0 }, role: 'admin' as const,
    labels: [{ id: 5, name: 'Bug', color: 'red' }],
    columns: [
      {
        id: 1,
        title: 'To Do',
        position: 0,
        cards: [card(1, 'Write announcement'), card(2, 'Fix checkout', { label_ids: [5], priority: 'urgent' })],
      },
      { id: 2, title: 'Done', position: 1, cards: [card(3, 'Pick colors', { completed: true })] },
    ],
  }
}

function renderBoard(props = {}) {
  return render(
    <ToastProvider>
      <BoardView boardId={1} userId={1} isGuest={false} onRenamed={vi.fn()} onDeleted={vi.fn()} {...props} />
    </ToastProvider>,
  )
}

const column = (name: string) => screen.getByRole('region', { name })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(boards.get).mockResolvedValue(sample())
})

describe('board view', () => {
  test('shows title, progress, columns and cards', async () => {
    renderBoard()
    expect(await screen.findByRole('heading', { name: 'Website Launch', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Cards completed' })).toHaveAttribute('aria-valuenow', '33')
    expect(screen.getByText('1 of 3 done')).toBeInTheDocument()
    expect(within(column('To Do')).getAllByRole('listitem')).toHaveLength(2)
    expect(within(column('Done')).getByText('Pick colors')).toBeInTheDocument()
  })

  test('adds a card from the column composer', async () => {
    vi.mocked(boards.addCard).mockResolvedValue(card(9, 'Ship it'))
    renderBoard()
    await screen.findByText('Write announcement')
    await userEvent.click(within(column('Done')).getByRole('button', { name: 'Add card' }))
    await userEvent.type(screen.getByLabelText('New card title'), 'Ship it{Enter}')
    expect(boards.addCard).toHaveBeenCalledWith(2, 'Ship it')
    expect(await within(column('Done')).findByText('Ship it')).toBeInTheDocument()
  })

  test('a full board shows the card limit message and adds nothing', async () => {
    const limit = 'Maximum cards in a board is 100. Delete a card to add a new one.'
    vi.mocked(boards.addCard).mockRejectedValue(new Error(limit))
    renderBoard()
    await screen.findByText('Write announcement')
    await userEvent.click(within(column('Done')).getByRole('button', { name: 'Add card' }))
    await userEvent.type(screen.getByLabelText('New card title'), 'One more{Enter}')
    expect(await screen.findByText(limit)).toBeInTheDocument()
    expect(within(column('Done')).queryByText('One more')).not.toBeInTheDocument()
  })

  test('renames a column in place', async () => {
    vi.mocked(boards.renameColumn).mockResolvedValue({ id: 1, title: 'Backlog', position: 0, cards: [] })
    renderBoard()
    await userEvent.click(await screen.findByRole('button', { name: 'To Do' }))
    const input = screen.getByLabelText('Rename column To Do')
    await userEvent.clear(input)
    await userEvent.type(input, 'Backlog{Enter}')
    expect(boards.renameColumn).toHaveBeenCalledWith(1, 'Backlog')
    expect(screen.getByRole('region', { name: 'Backlog' })).toBeInTheDocument()
  })

  test('search and filters narrow the cards and can be cleared', async () => {
    renderBoard()
    await screen.findByText('Write announcement')
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search cards' }), 'checkout')
    expect(screen.queryByText('Write announcement')).toBeNull()
    expect(screen.getByText('Fix checkout')).toBeInTheDocument()
    expect(screen.getByText(/showing 1 of 3 cards/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    await userEvent.selectOptions(screen.getByLabelText('Filter by status'), 'done')
    expect(screen.getByText('Pick colors')).toBeInTheDocument()
    expect(screen.queryByText('Fix checkout')).toBeNull()
    await userEvent.selectOptions(screen.getByLabelText('Filter by status'), 'all')
    await userEvent.selectOptions(screen.getByLabelText('Filter by label'), 'Bug')
    expect(screen.getByText('Fix checkout')).toBeInTheDocument()
    expect(screen.queryByText('Pick colors')).toBeNull()
  })

  test('drag handles are hidden while filtering', async () => {
    renderBoard()
    await screen.findByText('Write announcement')
    expect(screen.getByRole('button', { name: 'Move column To Do' })).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Filter by priority'), 'urgent')
    expect(screen.queryByRole('button', { name: 'Move column To Do' })).toBeNull()
  })

  test('keyboard shortcuts: N adds a card, / focuses search, ? shows help', async () => {
    renderBoard()
    await screen.findByText('Write announcement')
    await userEvent.keyboard('n')
    expect(within(column('To Do')).getByLabelText('New card title')).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    await userEvent.keyboard('/')
    expect(screen.getByRole('searchbox', { name: 'Search cards' })).toHaveFocus()
    await userEvent.click(document.body)
    await userEvent.keyboard('?')
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument()
  })

  test('completing a card from the board updates progress', async () => {
    vi.mocked(boards.updateCard).mockResolvedValue(card(1, 'Write announcement', { completed: true }))
    renderBoard()
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Completed: Write announcement' }))
    expect(boards.updateCard).toHaveBeenCalledWith(1, { completed: true })
    expect(screen.getByText('2 of 3 done')).toBeInTheDocument()
  })

  test('clicking a card opens its details and Close closes them', async () => {
    renderBoard()
    await userEvent.click(await screen.findByRole('button', { name: /fix checkout/i }))
    const dialog = screen.getByRole('dialog', { name: 'Fix checkout' })
    expect(within(dialog).getByLabelText('Priority')).toHaveValue('urgent')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog', { name: 'Fix checkout' })).toBeNull()
  })
})

describe('empty states', () => {
  test('a board without columns says how to start', async () => {
    vi.mocked(boards.get).mockResolvedValue({ ...sample(), columns: [] })
    renderBoard()
    expect(await screen.findByText('This board has no columns yet. Add one to start.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add column' })).toBeInTheDocument()
  })

  test('a column without cards says so', async () => {
    vi.mocked(boards.get).mockResolvedValue({ ...sample(), columns: [{ id: 9, title: 'Empty', position: 0, cards: [] }] })
    renderBoard()
    expect(await screen.findByText('No cards here yet')).toBeInTheDocument()
  })
})

describe('source safety (T-216)', () => {
  test('no component uses dangerouslySetInnerHTML', () => {
    const files = import.meta.glob(['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}'], {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>
    expect(Object.keys(files).length).toBeGreaterThan(20)
    const offenders = Object.entries(files).filter(([, source]) => source.includes('dangerouslySetInnerHTML'))
    expect(offenders.map(([path]) => path)).toEqual([])
  })
})
