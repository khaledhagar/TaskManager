import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { collab, type ActivityEntry, type Comment } from '../api/collab'
import { ActivityList } from './ActivityList'
import { CommentsSection } from './CommentsSection'
import { MentionInput } from './MentionInput'

vi.mock('../api/collab', () => ({
  collab: { comments: vi.fn(), addComment: vi.fn(), editComment: vi.fn(), deleteComment: vi.fn(), activity: vi.fn() },
}))

const members = [
  { user_id: 1, email: 'alice@example.com' },
  { user_id: 2, email: 'bob@example.com' },
  { user_id: 3, email: 'bea@example.com' },
]
const comment = (id: number, author: number, text: string): Comment => ({
  id,
  card_id: 7,
  author_id: author,
  author_email: members[author - 1].email,
  text,
  created_at: new Date().toISOString(),
  edited_at: null,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(collab.comments).mockResolvedValue([comment(1, 2, 'Looks **good**'), comment(2, 1, 'Mine')])
})

function renderComments(role: 'viewer' | 'updater' | 'admin' = 'updater', onCountChange = vi.fn()) {
  render(<CommentsSection cardId={7} members={members} role={role} userId={1} onCountChange={onCountChange} />)
}

describe('comments (T-650)', () => {
  test('lists comments with Markdown; the user writes, edits and deletes their own', async () => {
    vi.mocked(collab.addComment).mockResolvedValue(comment(3, 1, 'New one'))
    vi.mocked(collab.editComment).mockResolvedValue({ ...comment(2, 1, 'Mine, changed'), edited_at: new Date().toISOString() })
    vi.mocked(collab.deleteComment).mockResolvedValue(undefined)
    const onCountChange = vi.fn()
    renderComments('updater', onCountChange)
    expect(await screen.findByText('good', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByText('bob@example.com')).toBeInTheDocument()
    await userEvent.type(screen.getByRole('combobox', { name: 'Write a comment' }), 'New one')
    await userEvent.click(screen.getByRole('button', { name: 'Comment' }))
    expect(collab.addComment).toHaveBeenCalledWith(7, 'New one')
    expect(onCountChange).toHaveBeenLastCalledWith(3)
    const mine = screen.getByText('Mine').closest('li')!
    await userEvent.click(within(mine).getByRole('button', { name: 'Edit' }))
    await userEvent.type(within(mine).getByRole('combobox', { name: 'Edit your comment' }), ', changed')
    await userEvent.click(within(mine).getByRole('button', { name: 'Save' }))
    expect(collab.editComment).toHaveBeenCalledWith(2, 'Mine, changed')
    expect(await screen.findByText('(edited)')).toBeInTheDocument()
    const theirs = screen.getByText('good', { selector: 'strong' }).closest('li')!
    expect(within(theirs).queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(within(theirs).queryByRole('button', { name: 'Delete' })).toBeNull()
  })

  test('viewers read but cannot write', async () => {
    renderComments('viewer')
    await screen.findByText('Mine')
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.getByText('Members who can update tasks can comment.')).toBeInTheDocument()
  })

  test('the admin can delete anyone, after confirming', async () => {
    vi.mocked(collab.deleteComment).mockResolvedValue(undefined)
    renderComments('admin')
    const theirs = (await screen.findByText('good', { selector: 'strong' })).closest('li')!
    await userEvent.click(within(theirs).getByRole('button', { name: 'Delete' }))
    expect(collab.deleteComment).not.toHaveBeenCalled()
    await userEvent.click(within(theirs).getAllByRole('button', { name: 'Delete' }).at(-1)!)
    expect(collab.deleteComment).toHaveBeenCalledWith(1)
  })
})

function MentionField() {
  const [value, setValue] = useState('')
  return <MentionInput value={value} onChange={setValue} members={members} label="Comment" />
}

describe('mentions (T-651)', () => {
  test('@ suggests members; arrows and Enter pick one', async () => {
    render(<MentionField />)
    const field = screen.getByRole('combobox', { name: 'Comment' })
    await userEvent.type(field, 'Hi @b')
    const list = screen.getByRole('listbox', { name: 'Members to mention' })
    expect(within(list).getAllByRole('option').map((o) => o.textContent)).toEqual(['@bob@example.com', '@bea@example.com'])
    expect(field).toHaveAttribute('aria-expanded', 'true')
    await userEvent.keyboard('{ArrowDown}')
    expect(field).toHaveAttribute('aria-activedescendant', within(list).getAllByRole('option')[1].id)
    await userEvent.keyboard('{Enter}')
    expect(field).toHaveValue('Hi @bea@example.com ')
    expect(field).toHaveAttribute('aria-expanded', 'false')
  })

  test('a click picks a member; Escape closes the list', async () => {
    render(<MentionField />)
    const field = screen.getByRole('combobox', { name: 'Comment' })
    await userEvent.type(field, '@al')
    await userEvent.click(screen.getByRole('option', { name: '@alice@example.com' }))
    expect(field).toHaveValue('@alice@example.com ')
    await userEvent.type(field, '@b')
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('listbox', { hidden: true })).not.toBeVisible()
  })
})

describe('history (T-650)', () => {
  const entry = (id: number, title: string): ActivityEntry => ({
    id,
    kind: 'card.renamed',
    data: { title, old: 'x' },
    card_id: 7,
    actor_email: 'bob@example.com',
    created_at: new Date().toISOString(),
  })

  test('newest first and Show more for older entries', async () => {
    vi.mocked(collab.activity).mockResolvedValueOnce([entry(9, 'C'), entry(8, 'B')]).mockResolvedValueOnce([entry(7, 'A')])
    render(<ActivityList boardId={1} cardId={7} myEmail="alice@example.com" pageSize={2} />)
    expect(await screen.findByText('bob@example.com renamed "x" to "C"')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Show more' }))
    expect(collab.activity).toHaveBeenLastCalledWith(1, { cardId: 7, limit: 2, before: 8 })
    expect(await screen.findByText('bob@example.com renamed "x" to "A"')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull()
  })
})
