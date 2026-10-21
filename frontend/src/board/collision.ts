import { closestCenter, closestCorners, pointerWithin, type CollisionDetection } from '@dnd-kit/core'

const isColumn = (id: string | number) => String(id).startsWith('column-')

/**
 * How a dragged column or card picks its drop target.
 *
 * Cards follow the pointer: moving a card changes column heights, and a rectangle-based choice
 * (closest corners) could then pick the old column again, flipping the card back and forth
 * until React stops with "Maximum update depth exceeded". Keyboard drags have no pointer.
 */
export function boardCollision(type: 'card' | 'column' | undefined): CollisionDetection {
  return (args) => {
    if (type === 'column') {
      return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => isColumn(c.id)) })
    }
    const underPointer = pointerWithin(args)
    return underPointer.length ? underPointer : closestCorners(args)
  }
}
