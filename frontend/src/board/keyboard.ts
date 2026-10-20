import { KeyboardCode, type KeyboardCoordinateGetter } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'

/**
 * dnd-kit's keyboard moves, made safe for right-to-left boards. dnd-kit picks Left/Right targets
 * by their left edge, so in RTL a card's own column (whose left edge is left of the card) wins and
 * the card never leaves. Here Left/Right only consider targets whose center is clearly on that side.
 */
export const boardKeyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  const { collisionRect, droppableRects, droppableContainers } = args.context
  const sign = event.code === KeyboardCode.Left ? -1 : event.code === KeyboardCode.Right ? 1 : 0
  if (!sign || !collisionRect) return sortableKeyboardCoordinates(event, args)

  const center = collisionRect.left + collisionRect.width / 2
  const enabled = droppableContainers.getEnabled().filter((entry) => {
    const rect = droppableRects.get(entry.id)
    return rect && sign * (rect.left + rect.width / 2 - center) > collisionRect.width / 2
  })
  // sortableKeyboardCoordinates only reads getEnabled() and get() from the containers map.
  const sideways = {
    getEnabled: () => enabled,
    get: (id: Parameters<typeof droppableContainers.get>[0]) => droppableContainers.get(id),
  } as typeof droppableContainers
  return sortableKeyboardCoordinates(event, {
    ...args,
    context: { ...args.context, droppableContainers: sideways },
  })
}
