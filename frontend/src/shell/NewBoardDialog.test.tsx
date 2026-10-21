import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { ai } from '../api/ai'
import { boards } from '../api/boards'
import { templates } from '../api/templates'
import { NewBoardDialog } from './NewBoardDialog'

vi.mock('../api/boards', () => ({ boards: { create: vi.fn(), createFromTemplate: vi.fn() } }))
vi.mock('../api/templates', () => ({ templates: { list: vi.fn(async () => []), remove: vi.fn(async () => undefined) } }))
vi.mock('../api/ai', () => ({ ai: { startBoard: vi.fn() } }))

const board = { id: 9, title: 'Made', created_at: '', role: 'admin' as const }
const onCreated = vi.fn()
const onClose = vi.fn()

function open() {
  render(<NewBoardDialog open onClose={onClose} onCreated={onCreated} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(boards.create).mockResolvedValue(board)
  vi.mocked(ai.startBoard).mockResolvedValue(board)
})

describe('new board dialog (T-247)', () => {
  test('blank is the default and needs a name', async () => {
    open()
    expect(screen.getByRole('radio', { name: /Blank/ })).toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: 'Create board' }))
    expect(screen.getByText('Give the board a name.')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Board name'), ' Q4 roadmap ')
    await userEvent.click(screen.getByRole('button', { name: 'Create board' }))
    expect(boards.create).toHaveBeenCalledWith('Q4 roadmap', 'blank')
    expect(onCreated).toHaveBeenCalledWith(board)
    expect(onClose).toHaveBeenCalled()
  })

  test('a template is created with its name', async () => {
    open()
    await userEvent.click(screen.getByRole('radio', { name: /Sprint/ }))
    expect(screen.getByText(/Backlog, To Do, In Progress, Review and Done/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Board name'), 'Sprint 14')
    await userEvent.click(screen.getByRole('button', { name: 'Create board' }))
    expect(boards.create).toHaveBeenCalledWith('Sprint 14', 'sprint')
  })

  test('Describe it to AI builds the board from a description', async () => {
    open()
    await userEvent.click(screen.getByRole('radio', { name: /Describe it to AI/ }))
    expect(screen.queryByLabelText('Board name')).toBeNull()
    expect(screen.getByText(/third-party AI service/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Create with AI' }))
    expect(screen.getByText('Describe your project first.')).toBeInTheDocument()
    expect(ai.startBoard).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText('Describe your project'), 'Plan a bakery opening')
    await userEvent.click(screen.getByRole('button', { name: 'Create with AI' }))
    expect(ai.startBoard).toHaveBeenCalledWith('Plan a bakery opening', expect.any(AbortSignal))
    expect(onCreated).toHaveBeenCalledWith(board)
  })

  test('the AI request shows progress and can be cancelled', async () => {
    let signal: AbortSignal | undefined
    vi.mocked(ai.startBoard).mockImplementation((_text, s) => {
      signal = s
      return new Promise((_resolve, reject) =>
        s?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))),
      )
    })
    open()
    await userEvent.click(screen.getByRole('radio', { name: /Describe it to AI/ }))
    await userEvent.type(screen.getByLabelText('Describe your project'), 'A garden')
    await userEvent.click(screen.getByRole('button', { name: 'Create with AI' }))
    expect(screen.getByRole('status')).toHaveTextContent(/Building your board/)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel request' }))
    expect(signal?.aborted).toBe(true)
    expect(onCreated).not.toHaveBeenCalled()
  })
})

describe('own templates in the New board dialog (T-684)', () => {
  test('a saved template is listed, named for you and used to create the board', async () => {
    vi.mocked(templates.list).mockResolvedValue([{ id: 3, name: 'Launch kit', created_at: '' }])
    vi.mocked(boards.createFromTemplate).mockResolvedValue(board)
    open()
    await userEvent.click(await screen.findByRole('radio', { name: 'Launch kit' }))
    expect(screen.getByLabelText('Board name')).toHaveValue('Launch kit')
    expect(screen.getByText('Starts from your saved template.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Create board' }))
    expect(boards.createFromTemplate).toHaveBeenCalledWith('Launch kit', 3)
    expect(onCreated).toHaveBeenCalledWith(board)
  })

  test('a template can be deleted', async () => {
    vi.mocked(templates.list).mockResolvedValue([{ id: 3, name: 'Launch kit', created_at: '' }])
    open()
    await userEvent.click(await screen.findByRole('button', { name: 'Delete template Launch kit' }))
    expect(templates.remove).toHaveBeenCalledWith(3)
    expect(screen.queryByRole('radio', { name: 'Launch kit' })).toBeNull()
  })
})
