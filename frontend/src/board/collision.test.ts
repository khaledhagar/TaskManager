import type { ClientRect, CollisionDetection } from '@dnd-kit/core'
import { expect, test } from 'vitest'
import { boardCollision } from './collision'

const rect = (left: number, top: number, width: number, height: number): ClientRect => ({
  left, top, width, height, right: left + width, bottom: top + height,
})

const container = (id: string) => ({ id, key: id, data: { current: undefined }, disabled: false, node: { current: null }, rect: { current: null } })

/** Two tall columns side by side; the dragged card mostly covers column A, the pointer is in column B. */
function args(pointer: { x: number; y: number } | null): Parameters<CollisionDetection>[0] {
  const rects = new Map([
    ['column-1', rect(0, 0, 284, 3000)],
    ['column-2', rect(298, 0, 284, 3000)],
  ])
  return {
    active: { id: 'card-9', data: { current: undefined }, rect: { current: { initial: null, translated: null } } },
    collisionRect: rect(60, 100, 260, 60),
    droppableRects: rects,
    droppableContainers: [...rects.keys()].map(container),
    pointerCoordinates: pointer,
  }
}

test('a dragged card goes to the column under the pointer, so moving it cannot flip it back', () => {
  expect(boardCollision('card')(args({ x: 310, y: 120 }))[0].id).toBe('column-2')
})

test('keyboard drags have no pointer and fall back to the closest corners', () => {
  expect(boardCollision('card')(args(null))[0].id).toBe('column-1')
})

test('columns only collide with columns', () => {
  const a = args({ x: 310, y: 120 })
  a.droppableContainers.push(container('card-5'))
  a.droppableRects.set('card-5', rect(298, 100, 284, 60))
  expect(boardCollision('column')(a).map((c) => c.id)).not.toContain('card-5')
})
