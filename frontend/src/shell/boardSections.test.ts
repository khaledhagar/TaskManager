import { describe, expect, test } from 'vitest'
import type { BoardSummary } from '../api/boards'
import { boardSections } from './boardSections'

const b = (id: number, extra: Partial<BoardSummary> = {}): BoardSummary => ({
  id,
  title: `B${id}`,
  created_at: '',
  role: 'admin',
  ...extra,
})

describe('board switcher order (T-681, T-685)', () => {
  test('starred first, then own, then shared; archived boards in their own section', () => {
    const list = [b(1), b(2, { role: 'viewer' }), b(3, { starred: true, role: 'editor' }), b(4, { archived: true, starred: true })]
    const s = boardSections(list)
    expect(s.starred.map((x) => x.id)).toEqual([3])
    expect(s.own.map((x) => x.id)).toEqual([1])
    expect(s.shared.map((x) => x.id)).toEqual([2])
    expect(s.archived.map((x) => x.id)).toEqual([4])
  })
})
