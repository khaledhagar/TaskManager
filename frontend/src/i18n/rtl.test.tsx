/// <reference types="node" />
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Card } from '../api/boards'
import { CardItem } from '../board/CardItem'
import { FocusTimer } from '../timer/FocusTimer'
import { InlineText } from '../ui/InlineText'

vi.mock('../timer/sound', () => ({ playChime: vi.fn() }))

const card: Card = {
  id: 1,
  title: 'Fix checkout',
  details: 'Slow networks',
  completed: false,
  priority: 'high',
  due_date: null,
  position: 0,
  label_ids: [],
  checklist: [{ id: 1, text: 'a', done: false, position: 0 }],
  attachments: [],
}

beforeEach(() => localStorage.clear())

describe('user-typed text keeps its own direction (NFR-25)', () => {
  test('card titles and labels use dir=auto', () => {
    const labels = [{ id: 1, name: 'Bug', color: 'red' as const }]
    render(<CardItem card={{ ...card, label_ids: [1] }} labels={labels} onOpen={vi.fn()} onToggle={vi.fn()} />)
    expect(screen.getByText('Fix checkout')).toHaveAttribute('dir', 'auto')
    expect(screen.getByText('Bug').closest('[dir]')).toHaveAttribute('dir', 'auto')
  })

  test('inline titles use dir=auto while shown and while edited', async () => {
    render(<InlineText value="Q4 roadmap" label="Rename" onSave={vi.fn()} />)
    const button = screen.getByRole('button', { name: 'Q4 roadmap' })
    expect(button).toHaveAttribute('dir', 'auto')
    await userEvent.click(button)
    expect(screen.getByRole('textbox', { name: 'Rename' })).toHaveAttribute('dir', 'auto')
  })
})

describe('direction icons (T-246)', () => {
  test('the page mirrors icons marked flip-rtl when the direction is right-to-left', () => {
    const css = readFileSync(join(import.meta.dirname, '..', 'index.css'), 'utf-8')
    expect(css).toMatch(/\[dir='rtl'\] \.flip-rtl \{\s*transform: scaleX\(-1\);/)
  })

  test('checklist and description icons on a card are marked', () => {
    const { container } = render(<CardItem card={card} labels={[]} onOpen={vi.fn()} onToggle={vi.fn()} />)
    expect(container.querySelectorAll('svg.flip-rtl')).toHaveLength(2)
  })

  test('the focus timer skip icon is marked', async () => {
    render(<FocusTimer />)
    await userEvent.click(screen.getByRole('button', { name: 'Focus timer' }))
    const skip = screen.getByRole('button', { name: 'Skip to break' })
    expect(skip.querySelector('svg')).toHaveClass('flip-rtl')
  })
})
