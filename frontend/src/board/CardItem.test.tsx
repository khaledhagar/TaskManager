import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import type { Card } from '../api/boards'
import { CardItem } from './CardItem'
import * as display from './display'
import { Markdown } from './Markdown'

vi.mock('./display', async (load) => {
  const real = await load<typeof import('./display')>()
  return { ...real, priorityLabel: vi.fn(real.priorityLabel) }
})

const iso = (offset: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const card: Card = {
  id: 1,
  title: 'Fix checkout',
  details: 'Slow networks',
  completed: false,
  priority: 'urgent',
  due_date: iso(-1),
  position: 0,
  label_ids: [9],
  checklist: [
    { id: 1, text: 'a', done: true, position: 0 },
    { id: 2, text: 'b', done: false, position: 1 },
  ],
  attachments: [], assignee_ids: [],
}
const labels = [
  { id: 9, name: 'Bug', color: 'red' as const },
  { id: 8, name: 'Design', color: 'purple' as const },
]

describe('card tile (T-204)', () => {
  test('shows the initials of assigned members, at most 3 plus a count (T-574)', () => {
    const members = ['alice', 'bob', 'carol', 'dan'].map((name, i) => ({ user_id: i + 1, email: `${name}@example.com` }))
    render(<CardItem card={{ ...card, assignee_ids: [1, 2, 3, 4] }} labels={labels} members={members} onOpen={vi.fn()} onToggle={vi.fn()} />)
    const body = screen.getByRole('button', { name: /fix checkout/i })
    expect(body).toHaveTextContent('Assigned to alice@example.com, bob@example.com, carol@example.com, dan@example.com')
    expect(body).toHaveTextContent('ABC+1')
  })

  test('shows title, priority, labels, due date and checklist progress', () => {
    render(<CardItem card={card} labels={labels} onOpen={vi.fn()} onToggle={vi.fn()} />)
    const body = screen.getByRole('button', { name: /fix checkout/i })
    expect(body).toHaveTextContent('Urgent')
    expect(body).toHaveTextContent('Bug')
    expect(body).not.toHaveTextContent('Design')
    expect(body).toHaveTextContent('Overdue, due Yesterday')
    expect(body).toHaveTextContent('1/2')
    expect(body).toHaveTextContent('Has a description')
  })

  test('the checkbox toggles completion and the body opens the card', async () => {
    const onToggle = vi.fn()
    const onOpen = vi.fn()
    render(<CardItem card={card} labels={labels} onOpen={onOpen} onToggle={onToggle} />)
    const checkbox = screen.getByRole('checkbox', { name: 'Completed: Fix checkout' })
    expect(checkbox).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(checkbox)
    expect(onToggle).toHaveBeenCalled()
    expect(onOpen).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /fix checkout/i }))
    expect(onOpen).toHaveBeenCalled()
  })

  test('completed cards are marked and show no due warning', () => {
    render(
      <CardItem card={{ ...card, completed: true }} labels={labels} onOpen={vi.fn()} onToggle={vi.fn()} />,
    )
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByText(/overdue/i)).toBeNull()
  })
})

describe('markdown (T-209)', () => {
  test('renders headings, lists and safe links', () => {
    render(<Markdown text={'# Plan\n\n- one\n- two\n\n[docs](https://example.com)'} />)
    expect(screen.getByRole('heading', { name: 'Plan' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    const link = screen.getByRole('link', { name: 'docs' })
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  test('raw HTML is not rendered as elements', () => {
    const { container } = render(<Markdown text={'<img src=x onerror="alert(1)"><b>bold</b>'} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
  })

  test('javascript: links lose their href', () => {
    render(<Markdown text={'[click](javascript:alert(1))'} />)
    const link = screen.getByText('click').closest('a')
    expect(link?.getAttribute('href') ?? '').not.toMatch(/javascript/i)
  })
})

describe('drag performance (NFR-03)', () => {
  test('a card is not redrawn when only its callbacks change', () => {
    const draws = vi.mocked(display.priorityLabel)
    const { rerender } = render(<CardItem card={card} labels={labels} onOpen={vi.fn()} onToggle={vi.fn()} />)
    const before = draws.mock.calls.length
    rerender(<CardItem card={card} labels={labels} onOpen={vi.fn()} onToggle={vi.fn()} />)
    expect(draws.mock.calls.length).toBe(before)
    rerender(<CardItem card={{ ...card, title: 'New' }} labels={labels} onOpen={vi.fn()} onToggle={vi.fn()} />)
    expect(draws.mock.calls.length).toBe(before + 1)
  })
})
