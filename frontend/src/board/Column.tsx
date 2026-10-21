import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, MoreHorizontal, Plus } from 'lucide-react'
import { useState } from 'react'
import type { Board, Card, Column as ColumnType, Label } from '../api/boards'
import { useI18n } from '../i18n/context'
import { InlineText } from '../ui/InlineText'
import { Menu } from '../ui/Menu'
import css from './column.module.css'
import { CardComposer } from './CardComposer'
import { CardItem } from './CardItem'
import { cardKey, columnKey } from './logic'
import type { BoardActions } from './useBoard'
import { WipDialog } from './WipDialog'

type Props = {
  column: ColumnType
  cards: Card[]
  labels: Label[]
  members: Board['members']
  actions: BoardActions
  dragDisabled: boolean
  filtering: boolean
  composing: boolean
  onCompose: (open: boolean) => void
  onOpenCard: (id: number) => void
  /** Move one place earlier (-1) or later (1): the menu's Move left and Move right. */
  onMove?: (step: -1 | 1) => void
  canMove?: { back: boolean; forward: boolean }
}

/** One column: drag handle, inline title, card list, and the add-card composer. */
export function Column({ column, cards, labels, members, actions, dragDisabled, filtering, composing, onCompose, onOpenCard, onMove, canMove }: Props) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: columnKey(column.id),
    data: { type: 'column', columnId: column.id },
    disabled: dragDisabled,
  })
  const { t } = useI18n()
  const [settingWip, setSettingWip] = useState(false)
  // Left is earlier in English and later in Arabic (right to left).
  const rtl = document.documentElement.dir === 'rtl'
  const moves = onMove && canMove
    ? [
        ...((rtl ? canMove.forward : canMove.back)
          ? [{ kind: 'action' as const, label: t('column.moveLeft'), onSelect: () => onMove(rtl ? 1 : -1) }]
          : []),
        ...((rtl ? canMove.back : canMove.forward)
          ? [{ kind: 'action' as const, label: t('column.moveRight'), onSelect: () => onMove(rtl ? -1 : 1) }]
          : []),
      ]
    : []
  const limit = column.wip_limit
  const over = limit ? cards.length > limit : false
  const countLabel = over
    ? t('column.overLimit', { count: cards.length, limit: limit! })
    : t('column.cardCount', { count: cards.length })

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
        <span className={css.count} aria-label={countLabel} data-over={over || undefined}>
          {limit ? t('column.wipCount', { count: cards.length, limit }) : cards.length}
        </span>
        <Menu
          label={t('column.options', { title: column.title })}
          align="end"
          triggerClassName={css.columnMenu}
          trigger={<MoreHorizontal size={16} aria-hidden="true" />}
          items={[
            { kind: 'action', label: t('column.addCard'), onSelect: () => onCompose(true) },
            { kind: 'action', label: t('column.wipLimit'), onSelect: () => setSettingWip(true) },
            ...moves,
            { kind: 'action', label: t('column.archive'), onSelect: () => actions.archiveColumn(column.id) },
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
              members={members}
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
      <WipDialog
        column={settingWip ? column : null}
        onClose={() => setSettingWip(false)}
        onSave={(value) => actions.setWipLimit(column.id, value)}
      />
    </section>
  )
}

type CardProps = {
  card: Card
  columnId: number
  labels: Label[]
  members: Board['members']
  disabled: boolean
  onOpen: () => void
  onToggle: () => void
}

function SortableCard({ card, columnId, labels, members, disabled, onOpen, onToggle }: CardProps) {
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
        members={members}
        onOpen={onOpen}
        onToggle={onToggle}
        activatorRef={setActivatorNodeRef}
        activatorAttributes={attributes}
        activatorListeners={listeners}
      />
    </li>
  )
}
