import { describe, expect, test } from 'vitest'
import type { BoardSummary } from '../api/boards'
import { boardSections, firstBoard } from './boardSections'

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
    expect(firstBoard(list)?.id).toBe(3)
  })

  test('an archived board opens only when there is nothing else', () => {
    expect(firstBoard([b(4, { archived: true }), b(5)])?.id).toBe(5)
    expect(firstBoard([b(4, { archived: true })])?.id).toBe(4)
    expect(firstBoard([])).toBeUndefined()
  })
})
