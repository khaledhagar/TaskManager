import type { SensorContext } from '@dnd-kit/core'
import { describe, expect, test } from 'vitest'
import { boardKeyboardCoordinates } from './keyboard'

type Box = { left: number; top: number; width: number; height: number }
const rect = ({ left, top, width, height }: Box) => ({
  left, top, width, height, right: left + width, bottom: top + height,
})

/** Right-to-left board: the first column is on the right, the next one to its left. */
const LAYOUT: Record<string, Box> = {
  'column-1': { left: 1132, top: 220, width: 284, height: 360 },
  'card-1': { left: 1142, top: 270, width: 264, height: 64 },
  'card-2': { left: 1142, top: 345, width: 264, height: 64 },
  'column-2': { left: 834, top: 220, width: 284, height: 260 },
  'card-3': { left: 844, top: 270, width: 264, height: 64 },
}
const COLUMN_OF: Record<string, string> = { 'card-1': 'c1', 'card-2': 'c1', 'card-3': 'c2' }

function context(activeId: string): SensorContext {
  const containers = Object.keys(LAYOUT).map((id) => ({
    id,
    key: id,
    disabled: false,
    node: { current: document.createElement('div') },
    rect: { current: null },
    data: {
      current: id.startsWith('card')
        ? { sortable: { containerId: COLUMN_OF[id], index: Number(id.at(-1)) - 1, items: [] } }
        : { sortable: { containerId: 'columns', index: Number(id.at(-1)) - 1, items: [] } },
    },
  }))
  const byId = new Map(containers.map((c) => [c.id, c]))
  return {
    activatorEvent: null,
    active: byId.get(activeId),
    activeNode: null,
    collisionRect: rect(LAYOUT[activeId]),
    collisions: null,
    draggableNodes: new Map(),
    draggingNode: null,
    draggingNodeRect: null,
    droppableRects: new Map(Object.entries(LAYOUT).map(([id, box]) => [id, rect(box)])),
    droppableContainers: Object.assign(byId, { getEnabled: () => containers }),
    over: { id: 'card-1' },
    scrollableAncestors: [],
    scrollAdjustedTranslate: null,
  } as unknown as SensorContext
}

const press = (code: string, activeId = 'card-1') =>
  boardKeyboardCoordinates(new KeyboardEvent('keydown', { code }), {
    active: activeId,
    currentCoordinates: { x: LAYOUT[activeId].left, y: LAYOUT[activeId].top },
    context: context(activeId),
  })

describe('keyboard moves between columns in right-to-left', () => {
  test('ArrowLeft moves a card into the column on its left, not its own column', () => {
    const next = press('ArrowLeft')
    expect(next?.x).toBeLessThan(LAYOUT['column-2'].left + LAYOUT['column-2'].width)
  })

  test('ArrowRight from the first column finds nothing further right', () => {
    expect(press('ArrowRight')).toBeUndefined()
  })

  test('ArrowDown still moves within the column', () => {
    expect(press('ArrowDown')).toEqual({ x: LAYOUT['card-2'].left, y: LAYOUT['card-2'].top })
  })
})
