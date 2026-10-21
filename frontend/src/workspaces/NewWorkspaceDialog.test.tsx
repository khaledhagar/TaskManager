import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { ai } from '../api/ai'
import { boards } from '../api/boards'
import { workspaces } from '../api/workspaces'
import { NewBoardDialog } from '../shell/NewBoardDialog'
import { NewWorkspaceDialog } from './NewWorkspaceDialog'

vi.mock('../api/ai', () => ({ ai: { suggestColumns: vi.fn(), startBoard: vi.fn() } }))
vi.mock('../api/workspaces', () => ({ workspaces: { create: vi.fn() } }))
vi.mock('../api/boards', () => ({ boards: { createWithColumns: vi.fn(), create: vi.fn() } }))
vi.mock('../api/templates', () => ({ templates: { list: vi.fn(async () => []) } }))

const WS = { id: 7, name: 'Website relaunch', created_at: '' }
const summary = { id: 1, title: 'Design', created_at: '', role: 'admin' as const }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(workspaces.create).mockResolvedValue({ workspace: WS, boards: [summary] })
  vi.mocked(boards.createWithColumns).mockResolvedValue(summary)
})

const chips = (scope: HTMLElement) =>
  within(scope).getAllByRole('textbox', { name: /^Column \d+$/ }).map((i) => (i as HTMLInputElement).value)

describe('new workspace dialog (T-730)', () => {
  // Types a lot: give it room when the whole suite runs in parallel.
  test('several boards, AI columns for all in one request, edit, summary, create', { timeout: 15_000 }, async () => {
    vi.mocked(ai.suggestColumns).mockResolvedValue({
      ai: true,
      boards: [
        { title: 'Design', columns: ['Ideas', 'Drafts', 'Approved'] },
        { title: 'Development', columns: ['Backlog', 'Doing', 'Review', 'Shipped'] },
      ],
    })
    const onCreated = vi.fn()
    render(<NewWorkspaceDialog open onClose={vi.fn()} onCreated={onCreated} />)
    const dialog = screen.getByRole('dialog', { name: 'New workspace' })
    expect(within(dialog).getByText(/A workspace groups related boards/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Suggest columns with AI' }))
    expect(within(dialog).getByText('Give the workspace a name.')).toBeInTheDocument()
    expect(ai.suggestColumns).not.toHaveBeenCalled()

    await userEvent.type(within(dialog).getByLabelText('Workspace name'), 'Website relaunch')
    await userEvent.type(within(dialog).getByLabelText('Board 1 name'), 'Design')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add another board' }))
    await userEvent.type(within(dialog).getByLabelText('Board 2 name'), 'Development')
    expect(within(dialog).getByText('Creates the workspace "Website relaunch" with 2 boards.')).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Suggest columns with AI' }))
    expect(ai.suggestColumns).toHaveBeenCalledTimes(1)
    expect(ai.suggestColumns).toHaveBeenCalledWith(['Design', 'Development'], 'Website relaunch', expect.any(AbortSignal))
    const design = within(dialog).getByRole('group', { name: 'Columns of Design' })
    expect(chips(design)).toEqual(['Ideas', 'Drafts', 'Approved'])
    await userEvent.click(within(design).getByRole('button', { name: 'Remove column Drafts' }))
    await userEvent.click(within(design).getByRole('button', { name: 'Add column' }))
    await userEvent.type(within(design).getByRole('textbox', { name: 'Column 3' }), 'Live')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Create workspace' }))
    expect(workspaces.create).toHaveBeenCalledWith('Website relaunch', [
      { title: 'Design', columns: ['Ideas', 'Approved', 'Live'] },
      { title: 'Development', columns: ['Backlog', 'Doing', 'Review', 'Shipped'] },
    ])
    expect(onCreated).toHaveBeenCalledWith(WS, [summary])
  })

  test('without the AI the boards keep To Do, In Progress, Done and a note says so', async () => {
    vi.mocked(ai.suggestColumns).mockResolvedValue({ ai: false, boards: [{ title: 'Ops', columns: ['To Do', 'In Progress', 'Done'] }] })
    render(<NewWorkspaceDialog open onClose={vi.fn()} onCreated={vi.fn()} />)
    const dialog = screen.getByRole('dialog', { name: 'New workspace' })
    await userEvent.type(within(dialog).getByLabelText('Workspace name'), 'Ops')
    await userEvent.type(within(dialog).getByLabelText('Board 1 name'), 'Ops')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Suggest columns with AI' }))
    expect(within(dialog).getByText(/The AI is not available right now/)).toBeInTheDocument()
    expect(within(dialog).getByText('Creates the workspace "Ops" with 1 board.')).toBeInTheDocument()
  })

  test('a board can be removed while more than one is left', async () => {
    render(<NewWorkspaceDialog open onClose={vi.fn()} onCreated={vi.fn()} />)
    const dialog = screen.getByRole('dialog', { name: 'New workspace' })
    expect(within(dialog).queryByRole('button', { name: 'Remove board 1' })).toBeNull()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add another board' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove board 2' }))
    expect(within(dialog).queryByLabelText('Board 2 name')).toBeNull()
  })
})

describe('new board dialog: AI columns and workspace (T-731)', () => {
  test('suggests columns from the name and creates the board in the chosen workspace', async () => {
    vi.mocked(ai.suggestColumns).mockResolvedValue({ ai: true, boards: [{ title: 'Hiring', columns: ['Applied', 'Interview', 'Offer'] }] })
    const onCreated = vi.fn()
    render(<NewBoardDialog open onClose={vi.fn()} onCreated={onCreated} workspaces={[WS]} />)
    const dialog = screen.getByRole('dialog', { name: 'New board' })
    expect(within(dialog).getByText(/A board is one stream of work/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Suggest columns with AI' }))
    expect(within(dialog).getByText('Give the board a name.')).toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText('Board name'), 'Hiring')
    await userEvent.selectOptions(within(dialog).getByLabelText('Workspace'), 'Website relaunch')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Suggest columns with AI' }))
    expect(ai.suggestColumns).toHaveBeenCalledWith(['Hiring'], 'Website relaunch', expect.any(AbortSignal))
    expect(chips(dialog)).toEqual(['Applied', 'Interview', 'Offer'])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create board' }))
    expect(boards.createWithColumns).toHaveBeenCalledWith('Hiring', ['Applied', 'Interview', 'Offer'], 7)
    expect(onCreated).toHaveBeenCalledWith(summary)
  })

  test('Add board from a workspace opens with that workspace chosen', () => {
    render(<NewBoardDialog open onClose={vi.fn()} onCreated={vi.fn()} workspaces={[WS]} workspaceId={7} />)
    expect(screen.getByLabelText('Workspace')).toHaveValue('7')
  })
})
