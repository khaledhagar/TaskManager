import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { boards, type BoardSummary } from '../api/boards'
import { notifications, type Notice } from '../api/notifications'
import { templates } from '../api/templates'
import { workspaces } from '../api/workspaces'
import { OPEN_BELL } from '../shell/notices'
import { ToastProvider } from '../ui/Toast'
import { StartScreen } from './StartScreen'

vi.mock('../api/workspaces', () => ({ workspaces: { members: vi.fn(), rename: vi.fn(), remove: vi.fn() } }))
vi.mock('../api/notifications', () => ({ notifications: { list: vi.fn(), read: vi.fn(async () => undefined) } }))
vi.mock('../api/templates', () => ({ templates: { list: vi.fn() } }))
vi.mock('../api/boards', () => ({ boards: { createFromTemplate: vi.fn() } }))

const board = (id: number, title: string, extra: Partial<BoardSummary> = {}): BoardSummary => ({
  id,
  title,
  created_at: '',
  role: 'admin',
  cards: 4,
  done: 1,
  ...extra,
})
const WS = [{ id: 7, name: 'Website relaunch', created_at: '' }]
const BOARDS = [
  board(1, 'Design', { workspace_id: 7 }),
  board(2, 'Groceries'),
  board(3, 'Team plan', { role: 'viewer' }),
  board(4, 'Old', { archived: true }),
  board(5, 'Launch', { starred: true }),
]
const notice = (id: number, read: boolean, extra: Partial<Notice> = {}): Notice => ({
  id,
  kind: 'card_changed',
  board_id: 1,
  card_id: 9,
  actor_email: 'bob@example.com',
  data: { title: `Card ${id}`, board: 'Design', change: 'card.moved' },
  created_at: new Date().toISOString(),
  read,
  ...extra,
})

const props = {
  onNewWorkspace: vi.fn(),
  onNewBoard: vi.fn(),
  onWorkspacesChange: vi.fn(),
  onWorkspaceDeleted: vi.fn(),
  onBoardCreated: vi.fn(),
}

function renderStart(list = BOARDS, ws = WS) {
  render(
    <ToastProvider>
      <StartScreen boards={list} workspaces={ws} {...props} />
    </ToastProvider>,
  )
}

const main = () => screen.getByRole('region', { name: 'Your work' })

beforeEach(() => {
  vi.clearAllMocks()
  history.replaceState(null, '', '/')
  vi.mocked(notifications.list).mockResolvedValue({ unread: 0, items: [] })
  vi.mocked(templates.list).mockResolvedValue([])
})

describe('start page middle (T-727, T-728)', () => {
  test('starred, each workspace with its boards, boards without a workspace, shared, archived folded', async () => {
    renderStart()
    const headings = within(main()).getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings.indexOf('Starred')).toBeLessThan(headings.indexOf('Website relaunch'))
    expect(headings.indexOf('Website relaunch')).toBeLessThan(headings.indexOf('Boards without a workspace'))
    expect(headings.indexOf('Boards without a workspace')).toBeLessThan(headings.indexOf('Shared with you'))
    const ws = within(main()).getByRole('region', { name: 'Website relaunch' })
    expect(within(ws).getByRole('link', { name: /^Design/ })).toHaveAttribute('href', '/?board=1')
    expect(within(ws).getByRole('link', { name: /^Design/ })).toHaveTextContent('1 of 4 done')
    expect(screen.getByText('Archived').closest('details')).not.toHaveAttribute('open')
  })

  test('an empty account sees only the two start cards with their explanations', () => {
    renderStart([], [])
    expect(screen.getByRole('button', { name: 'New workspace' })).toHaveAccessibleDescription(/A workspace groups related boards/)
    expect(screen.getByRole('button', { name: 'New board' })).toHaveAccessibleDescription(/A board is one stream of work/)
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.queryByText("What's new")).toBeNull()
    expect(screen.getByText(/You have no boards yet/)).toBeInTheDocument()
  })

  test('the start cards open the two dialogs; Add board picks the workspace', async () => {
    renderStart()
    await userEvent.click(within(main()).getByRole('button', { name: 'New workspace' }))
    expect(props.onNewWorkspace).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Add board to Website relaunch' }))
    expect(props.onNewBoard).toHaveBeenCalledWith(7)
  })
})

describe('left panel (T-738, T-740)', () => {
  test('Boards lists a workspace\'s boards; Members shows its members board by board', async () => {
    vi.mocked(workspaces.members).mockResolvedValue([
      { board_id: 1, title: 'Design', members: [{ email: 'ann@example.com', role: 'admin' }, { email: 'bob@example.com', role: 'updater' }] },
    ])
    renderStart()
    const panel = screen.getByRole('navigation', { name: 'Workspaces and boards' })
    const toggle = within(panel).getByRole('button', { name: 'Boards: Website relaunch' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(within(panel).getByRole('link', { name: 'Design' })).toHaveAttribute('href', '/?board=1')
    await userEvent.click(within(panel).getByRole('button', { name: 'Members: Website relaunch' }))
    const dialog = screen.getByRole('dialog', { name: 'Members of Website relaunch' })
    expect(await within(dialog).findByText('bob@example.com')).toBeInTheDocument()
    expect(within(dialog).getByText('Can update tasks')).toBeInTheDocument()
    expect(workspaces.members).toHaveBeenCalledWith(7)
  })

  test('boards without a workspace have their own Members; shared boards have none', async () => {
    vi.mocked(workspaces.members).mockResolvedValue([])
    renderStart()
    const panel = screen.getByRole('navigation', { name: 'Workspaces and boards' })
    await userEvent.click(within(panel).getByRole('button', { name: 'Members: Boards without a workspace' }))
    expect(workspaces.members).toHaveBeenCalledWith('none')
    expect(within(panel).queryByRole('button', { name: 'Members: Shared with you' })).toBeNull()
  })

  test('on small screens a button shows and hides the panel', async () => {
    renderStart()
    const toggle = screen.getByRole('button', { name: 'Workspaces and boards' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })
})

describe("What's new and templates (T-744, T-756)", () => {
  test('latest notifications, unread first, up to 5; one opens its card; See all opens the bell', async () => {
    const items = [notice(1, true), notice(2, false), notice(3, true), notice(4, false), notice(5, true), notice(6, true)]
    vi.mocked(notifications.list).mockResolvedValue({ unread: 2, items })
    const opened = vi.fn()
    window.addEventListener(OPEN_BELL, opened)
    renderStart()
    const news = await screen.findByRole('region', { name: "What's new" })
    const entries = within(news).getAllByRole('button', { name: /moved/ })
    expect(entries).toHaveLength(5)
    expect(entries[0]).toHaveTextContent('bob@example.com moved "Card 4" on Design')
    expect(entries[1]).toHaveTextContent('Card 2')
    await userEvent.click(entries[0])
    expect(notifications.read).toHaveBeenCalledWith(4)
    expect(location.search).toBe('?board=1&card=9')
    await userEvent.click(within(news).getByRole('button', { name: 'See all notifications' }))
    expect(opened).toHaveBeenCalled()
    window.removeEventListener(OPEN_BELL, opened)
  })

  test('an invitation opens the invitation page', async () => {
    vi.mocked(notifications.list).mockResolvedValue({
      unread: 1,
      items: [notice(1, false, { kind: 'invited', card_id: null, data: { board: 'Launch', path: '/invite#token=abc' } })],
    })
    renderStart()
    await userEvent.click(await screen.findByRole('button', { name: /invited you to the board "Launch"/ }))
    expect(location.pathname + location.hash).toBe('/invite#token=abc')
  })

  test('saved templates show on the start page and start a board in one click', async () => {
    vi.mocked(templates.list).mockResolvedValue([{ id: 3, name: 'Release kit', created_at: '' }])
    vi.mocked(boards.createFromTemplate).mockResolvedValue(board(9, 'Release kit'))
    renderStart()
    await userEvent.click(await screen.findByRole('button', { name: 'Use template Release kit' }))
    expect(boards.createFromTemplate).toHaveBeenCalledWith('Release kit', 3)
    expect(props.onBoardCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }))
  })
})
