import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Card } from '../api/boards'
import { CardModal } from './CardModal'
import type { BoardActions } from './useBoard'

const card: Card = {
  id: 7,
  title: 'Design pricing page',
  details: '',
  completed: false,
  priority: 'high',
  due_date: null,
  position: 0,
  label_ids: [1],
  checklist: [
    { id: 11, text: 'Draft wireframe', done: true, position: 0 },
    { id: 12, text: 'Review copy', done: false, position: 1 },
  ],
  attachments: [],
}
const labels = [
  { id: 1, name: 'Design', color: 'purple' as const },
  { id: 2, name: 'Bug', color: 'red' as const },
]

let actions: BoardActions
beforeEach(() => {
  actions = {
    updateCard: vi.fn(),
    setCardLabels: vi.fn(),
    addItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    addLabel: vi.fn(),
    deleteLabel: vi.fn(),
    deleteCard: vi.fn(),
  } as unknown as BoardActions
})

function open(overrides: Partial<Card> = {}, onClose = vi.fn()) {
  render(<CardModal card={{ ...card, ...overrides }} labels={labels} actions={actions} onClose={onClose} />)
  return screen.getByRole('dialog', { name: overrides.title ?? card.title })
}

describe('card modal (T-208)', () => {
  test('title saves on Enter, trimmed', async () => {
    const dialog = open()
    const title = within(dialog).getByLabelText('Title')
    await userEvent.clear(title)
    await userEvent.type(title, '  Pricing page v2  {Enter}')
    expect(actions.updateCard).toHaveBeenCalledWith(7, { title: 'Pricing page v2' })
  })

  test('an empty title is not saved', async () => {
    const dialog = open()
    const title = within(dialog).getByLabelText('Title')
    await userEvent.clear(title)
    await userEvent.tab()
    expect(actions.updateCard).not.toHaveBeenCalled()
    expect(title).toHaveValue('Design pricing page')
  })

  test('description is written in markdown, saved, and previewed', async () => {
    const dialog = open()
    await userEvent.type(within(dialog).getByLabelText('Description'), '# Goals')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save description' }))
    expect(actions.updateCard).toHaveBeenCalledWith(7, { details: '# Goals' })
  })

  test('existing description opens in preview', () => {
    const dialog = open({ details: '## Notes\n\n- point' })
    expect(within(dialog).getByRole('heading', { name: 'Notes' })).toBeInTheDocument()
  })

  test('completed, priority and due date save at once', async () => {
    const dialog = open()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark complete' }))
    expect(actions.updateCard).toHaveBeenCalledWith(7, { completed: true })
    await userEvent.selectOptions(within(dialog).getByLabelText('Priority'), 'urgent')
    expect(actions.updateCard).toHaveBeenCalledWith(7, { priority: 'urgent' })
    const due = within(dialog).getByLabelText('Due date')
    await userEvent.type(due, '2026-12-31')
    expect(actions.updateCard).toHaveBeenCalledWith(7, { due_date: '2026-12-31' })
  })

  test('clearing the due date saves null', async () => {
    const dialog = open({ due_date: '2026-12-31' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Clear due date' }))
    expect(actions.updateCard).toHaveBeenCalledWith(7, { due_date: null })
  })

  test('labels toggle and new labels can be created', async () => {
    vi.mocked(actions.addLabel).mockResolvedValue({ id: 3, name: 'Urgent fix', color: 'orange' })
    const dialog = open()
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Bug' }))
    expect(actions.setCardLabels).toHaveBeenCalledWith(7, [1, 2])
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Design' }))
    expect(actions.setCardLabels).toHaveBeenCalledWith(7, [])
    await userEvent.type(within(dialog).getByLabelText('New label name'), 'Urgent fix')
    await userEvent.click(within(dialog).getByRole('radio', { name: 'orange' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add label' }))
    expect(actions.addLabel).toHaveBeenCalledWith('Urgent fix', 'orange')
    expect(actions.setCardLabels).toHaveBeenLastCalledWith(7, [1, 3])
  })

  test('checklist shows progress and items can be added, ticked and deleted', async () => {
    const dialog = open()
    expect(within(dialog).getByText('1 of 2 done')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Review copy' }))
    expect(actions.updateItem).toHaveBeenCalledWith(7, 12, { done: true })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete item: Draft wireframe' }))
    expect(actions.deleteItem).toHaveBeenCalledWith(7, 11)
    await userEvent.type(within(dialog).getByLabelText('Add an item'), 'Ship it{Enter}')
    expect(actions.addItem).toHaveBeenCalledWith(7, 'Ship it')
  })

  test('delete card closes the window', async () => {
    const onClose = vi.fn()
    const dialog = open({}, onClose)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete card' }))
    expect(actions.deleteCard).toHaveBeenCalledWith(7)
    expect(onClose).toHaveBeenCalled()
  })

  test('deleting a label from the board asks first', async () => {
    const dialog = open()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete label Bug from this board' }))
    expect(actions.deleteLabel).not.toHaveBeenCalled()
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Remove "Bug" from all cards')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep' }))
    expect(within(dialog).queryByRole('alert')).toBeNull()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete label Bug from this board' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove label' }))
    expect(actions.deleteLabel).toHaveBeenCalledWith(2)
  })
})
