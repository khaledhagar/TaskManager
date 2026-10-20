import {
  closestCenter,
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { horizontalListSortingStrategy, SortableContext } from '@dnd-kit/sortable'
import { useState, type ReactNode } from 'react'
import type { Board } from '../api/boards'
import { useI18n } from '../i18n/context'
import css from './board.module.css'
import { CardItem } from './CardItem'
import { Column } from './Column'
import { boardKeyboardCoordinates } from './keyboard'
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

/** Settle the dropped card quickly; no animation when the system asks for reduced motion. */
const DROP = matchMedia('(prefers-reduced-motion: reduce)').matches
  ? null
  : { duration: 200, easing: 'cubic-bezier(0.2, 0, 0, 1)' }

const parse = (key: string | number) => {
  const [type, id] = String(key).split('-')
  return { type: type as 'card' | 'column', id: Number(id) }
}

/** Columns and cards with drag and drop (pointer and keyboard), saved when dropped. */
export function BoardColumns({ board, actions, filters, dragDisabled, composingColumn, onCompose, onOpenCard, after }: Props) {
  const { t } = useI18n()
  const [drag, setDrag] = useState<Drag>(null)
  const [preview, setPreview] = useState<Board | null>(null)
  const shown = preview ?? board

  // Touch: press and hold to pick up, so a quick swipe still scrolls the page.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: boardKeyboardCoordinates,
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
    if (type === 'column') return t('dnd.column', { title: shown.columns.find((c) => c.id === id)?.title ?? '' })
    return t('dnd.card', { title: findCard(shown, id)?.card.title ?? '' })
  }
  const columnTitle = (key: string | number) => shown.columns.find((c) => c.id === columnOf(shown, key))?.title
  const announcements: Announcements = {
    onDragStart: ({ active }) => t('dnd.pickedUp', { item: titleOf(active.id) }),
    onDragOver: ({ active, over }) => {
      if (!over) return ''
      const column = columnTitle(over.id)
      const params = { item: titleOf(active.id), target: titleOf(over.id) }
      return column ? t('dnd.overIn', { ...params, column }) : t('dnd.over', params)
    },
    onDragEnd: ({ active, over }) => {
      const column = over ? columnTitle(over.id) : undefined
      const item = titleOf(active.id)
      return column ? t('dnd.droppedIn', { item, column }) : t('dnd.dropped', { item })
    },
    onDragCancel: ({ active }) => t('dnd.cancelled', { item: titleOf(active.id) }),
  }

  const activeCard = drag?.type === 'card' ? findCard(shown, drag.id)?.card : undefined

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      accessibility={{ announcements, screenReaderInstructions: { draggable: t('dnd.instructions') } }}
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
      <DragOverlay dropAnimation={DROP}>
        {activeCard ? (
          <div className={css.overlay}>
            <CardItem card={activeCard} labels={shown.labels} onOpen={() => {}} onToggle={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
