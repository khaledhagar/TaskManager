import {
  closestCenter,
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useState, type ReactNode } from 'react'
import type { Board } from '../api/boards'
import css from './board.module.css'
import { CardItem } from './CardItem'
import { Column } from './Column'
import { columnKey, findCard, matchesFilters, moveCard, type Filters } from './logic'
import type { BoardActions } from './useBoard'

type Props = {
  board: Board
  actions: BoardActions
  filters: Filters
  dragDisabled: boolean
  composingColumn: number | null
  onCompose: (columnId: number | null) => void
  onOpenCard: (id: number) => void
  after?: ReactNode
}

type Drag = { type: 'card' | 'column'; id: number } | null

const parse = (key: string | number) => {
  const [type, id] = String(key).split('-')
  return { type: type as 'card' | 'column', id: Number(id) }
}

/** Columns and cards with drag and drop (pointer and keyboard), saved when dropped. */
export function BoardColumns({ board, actions, filters, dragDisabled, composingColumn, onCompose, onOpenCard, after }: Props) {
  const [drag, setDrag] = useState<Drag>(null)
  const [preview, setPreview] = useState<Board | null>(null)
  const shown = preview ?? board

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  )

  const collision: CollisionDetection = (args) =>
    drag?.type === 'column'
      ? closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter((c) => parse(c.id).type === 'column'),
        })
      : closestCorners(args)

  const columnOf = (b: Board, key: string | number) => {
    const target = parse(key)
    return target.type === 'column' ? target.id : findCard(b, target.id)?.column.id
  }

  function onDragStart({ active }: DragStartEvent) {
    setDrag(parse(active.id))
    setPreview(board)
  }

  function onDragOver({ active, over }: DragOverEvent) {
    const dragged = parse(active.id)
    if (dragged.type !== 'card' || !over || !preview) return
    const from = findCard(preview, dragged.id)?.column.id
    const to = columnOf(preview, over.id)
    if (to === undefined || from === to) return
    const target = parse(over.id)
    const column = preview.columns.find((c) => c.id === to)!
    const index = target.type === 'card' ? column.cards.findIndex((c) => c.id === target.id) : column.cards.length
    setPreview(moveCard(preview, dragged.id, to, index < 0 ? column.cards.length : index))
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const dragged = parse(active.id)
    const current = preview ?? board
    setDrag(null)
    setPreview(null)
    if (!over) return
    if (dragged.type === 'column') {
      const target = parse(over.id)
      const ids = board.columns.map((c) => c.id)
      const from = ids.indexOf(dragged.id)
      const to = ids.indexOf(target.id)
      if (target.type !== 'column' || from === to) return
      ids.splice(to, 0, ids.splice(from, 1)[0])
      actions.reorderColumns(ids)
      return
    }
    const place = findCard(current, dragged.id)!
    const target = parse(over.id)
    let index = place.index
    if (target.type === 'card' && target.id !== dragged.id) {
      const overPlace = findCard(current, target.id)
      if (overPlace && overPlace.column.id === place.column.id) index = overPlace.index
    }
    const original = findCard(board, dragged.id)!
    if (original.column.id !== place.column.id || original.index !== index) {
      actions.moveCard(dragged.id, place.column.id, index)
    }
  }

  const titleOf = (key: string | number) => {
    const { type, id } = parse(key)
    if (type === 'column') return `column ${shown.columns.find((c) => c.id === id)?.title ?? ''}`
    return `card ${findCard(shown, id)?.card.title ?? ''}`
  }
  const where = (key: string | number) => {
    const col = shown.columns.find((c) => c.id === columnOf(shown, key))
    return col ? ` in column ${col.title}` : ''
  }
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${titleOf(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${titleOf(active.id)} is over ${titleOf(over.id)}${where(over.id)}.` : ''),
    onDragEnd: ({ active, over }) => (over ? `Dropped ${titleOf(active.id)}${where(over.id)}.` : `Dropped ${titleOf(active.id)}.`),
    onDragCancel: ({ active }) => `Cancelled. ${titleOf(active.id)} was not moved.`,
  }

  const activeCard = drag?.type === 'card' ? findCard(shown, drag.id)?.card : undefined

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      accessibility={{ announcements }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setDrag(null)
        setPreview(null)
      }}
    >
      <div className={css.columns}>
        <SortableContext items={shown.columns.map((c) => columnKey(c.id))} strategy={horizontalListSortingStrategy}>
          {shown.columns.map((column) => (
            <Column
              key={column.id}
              column={column}
              cards={column.cards.filter((c) => matchesFilters(c, filters))}
              labels={shown.labels}
              actions={actions}
              dragDisabled={dragDisabled}
              filtering={dragDisabled}
              composing={composingColumn === column.id}
              onCompose={(open) => onCompose(open ? column.id : null)}
              onOpenCard={onOpenCard}
            />
          ))}
        </SortableContext>
        {after}
      </div>
      <DragOverlay>
        {activeCard ? (
          <div className={css.overlay}>
            <CardItem card={activeCard} labels={shown.labels} onOpen={() => {}} onToggle={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
