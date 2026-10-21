import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, MoreHorizontal, Plus } from 'lucide-react'
import type { Card, Column as ColumnType, Label } from '../api/boards'
import { useI18n } from '../i18n/context'
import { InlineText } from '../ui/InlineText'
import { Menu } from '../ui/Menu'
import css from './column.module.css'
import { CardComposer } from './CardComposer'
import { CardItem } from './CardItem'
import { cardKey, columnKey } from './logic'
import type { BoardActions } from './useBoard'

type Props = {
  column: ColumnType
  cards: Card[]
  labels: Label[]
  actions: BoardActions
  dragDisabled: boolean
  filtering: boolean
  composing: boolean
  onCompose: (open: boolean) => void
  onOpenCard: (id: number) => void
}

/** One column: drag handle, inline title, card list, and the add-card composer. */
export function Column({ column, cards, labels, actions, dragDisabled, filtering, composing, onCompose, onOpenCard }: Props) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: columnKey(column.id),
    data: { type: 'column', columnId: column.id },
    disabled: dragDisabled,
  })
  const { t } = useI18n()

  return (
    <section
      ref={setNodeRef}
      className={css.column}
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      aria-label={column.title}
    >
      <header className={css.columnHead}>
        {dragDisabled ? null : (
          <button
            type="button"
            ref={setActivatorNodeRef}
            className={css.grip}
            aria-label={t('column.move', { title: column.title })}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={16} aria-hidden="true" />
          </button>
        )}
        <h2 className={css.columnTitle}>
          <InlineText
            value={column.title}
            label={t('column.rename', { title: column.title })}
            className={css.columnTitleButton}
            inputClassName={css.columnTitleInput}
            onSave={(title) => actions.renameColumn(column.id, title)}
          />
        </h2>
        <span className={css.count} aria-label={t('column.cardCount', { count: cards.length })}>
          {cards.length}
        </span>
        <Menu
          label={t('column.options', { title: column.title })}
          align="end"
          triggerClassName={css.columnMenu}
          trigger={<MoreHorizontal size={16} aria-hidden="true" />}
          items={[
            { kind: 'action', label: t('column.addCard'), onSelect: () => onCompose(true) },
            { kind: 'action', label: t('column.delete'), danger: true, onSelect: () => actions.deleteColumn(column.id) },
          ]}
        />
      </header>

      <SortableContext items={cards.map((c) => cardKey(c.id))} strategy={verticalListSortingStrategy}>
        <ul className={css.cards}>
          {cards.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              columnId={column.id}
              labels={labels}
              disabled={dragDisabled}
              onOpen={() => onOpenCard(card.id)}
              onToggle={() => actions.updateCard(card.id, { completed: !card.completed })}
            />
          ))}
          {cards.length === 0 && !composing ? <li className={css.emptyColumn}>{t(filtering ? 'column.noMatches' : 'column.empty')}</li> : null}
        </ul>
      </SortableContext>

      {composing ? (
        <CardComposer onAdd={(title) => actions.addCard(column.id, title)} onClose={() => onCompose(false)} />
      ) : (
        <button type="button" className={css.addCard} onClick={() => onCompose(true)}>
          <Plus size={16} aria-hidden="true" />
          {t('column.addCard')}
        </button>
      )}
    </section>
  )
}

type CardProps = {
  card: Card
  columnId: number
  labels: Label[]
  disabled: boolean
  onOpen: () => void
  onToggle: () => void
}

function SortableCard({ card, columnId, labels, disabled, onOpen, onToggle }: CardProps) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: cardKey(card.id),
    data: { type: 'card', columnId },
    disabled,
  })
  return (
    <li
      ref={setNodeRef}
      className={css.cardSlot}
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <CardItem
        card={card}
        labels={labels}
        onOpen={onOpen}
        onToggle={onToggle}
        activatorRef={setActivatorNodeRef}
        activatorAttributes={attributes}
        activatorListeners={listeners}
      />
    </li>
  )
}
