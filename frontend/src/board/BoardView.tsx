import { Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { boards } from '../api/boards'
import { InlineText } from '../ui/InlineText'
import ui from '../ui/ui.module.css'
import css from './board.module.css'
import { BoardColumns } from './BoardColumns'
import { BoardHeader } from './BoardHeader'
import { CardModal } from './CardModal'
import { FilterBar } from './FilterBar'
import { EMPTY_FILTERS, filtersActive, findCard, matchesFilters } from './logic'
import { ShortcutsHelp } from './ShortcutsHelp'
import { useBoard } from './useBoard'
import { useShortcuts } from './useShortcuts'

type Props = {
  boardId: number
  onRenamed: (id: number, title: string) => void
  onDeleted: (id: number) => void
}

/** The interactive board: header, filters, columns with drag and drop, card details. */
export function BoardView({ boardId, onRenamed, onDeleted }: Props) {
  const { board, loadError, actions } = useBoard(boardId)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [openCardId, setOpenCardId] = useState<number | null>(null)
  const [composing, setComposing] = useState<number | null>(null)
  const [help, setHelp] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useShortcuts({
    n: () => board?.columns[0] && setComposing(board.columns[0].id),
    '/': () => searchRef.current?.focus(),
    '?': () => setHelp(true),
  })

  if (loadError)
    return (
      <p className={ui.alert} role="alert">
        {loadError}
      </p>
    )
  if (!board) return <div className={css.skeleton} role="status" aria-label="Loading board" />

  const cards = board.columns.flatMap((c) => c.cards)
  const shown = cards.filter((c) => matchesFilters(c, filters)).length
  const filtering = filtersActive(filters)
  const openCard = openCardId === null ? undefined : findCard(board, openCardId)?.card

  return (
    <section className={css.board}>
      <BoardHeader
        board={board}
        onRename={(title) => {
          actions.renameBoard(title)
          onRenamed(board.id, title)
        }}
        onDelete={async () => {
          await boards.remove(board.id)
          onDeleted(board.id)
        }}
        onHelp={() => setHelp(true)}
      />
      <FilterBar
        filters={filters}
        onChange={setFilters}
        labels={board.labels}
        shown={shown}
        total={cards.length}
        searchRef={searchRef}
      />
      {filtering && shown === 0 ? (
        <p className={css.noResults}>
          No cards match these filters.{' '}
          <button type="button" className={ui.linkButton} onClick={() => setFilters(EMPTY_FILTERS)}>
            Clear filters
          </button>
        </p>
      ) : null}
      <BoardColumns
        board={board}
        actions={actions}
        filters={filters}
        dragDisabled={filtering}
        composingColumn={composing}
        onCompose={setComposing}
        onOpenCard={setOpenCardId}
        after={<AddColumn onAdd={(title) => actions.addColumn(title)} />}
      />
      {openCard ? (
        <CardModal
          key={openCard.id}
          card={openCard}
          labels={board.labels}
          actions={actions}
          onClose={() => setOpenCardId(null)}
        />
      ) : null}
      <ShortcutsHelp open={help} onClose={() => setHelp(false)} />
    </section>
  )
}

function AddColumn({ onAdd }: { onAdd: (title: string) => void }) {
  return (
    <div className={css.addColumn}>
      <InlineText
        value=""
        label="Add column"
        className={css.addColumnButton}
        inputClassName={`${ui.input} ${css.addColumnInput}`}
        onSave={onAdd}
      >
        <Plus size={16} aria-hidden="true" />
        Add column
      </InlineText>
    </div>
  )
}
