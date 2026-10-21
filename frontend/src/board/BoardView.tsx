import { Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { boards, type BoardSummary } from '../api/boards'
import { ChatPanel } from '../ai/ChatPanel'
import { Backdrop } from '../files/Backdrop'
import { BackgroundPicker } from '../files/BackgroundPicker'
import { useI18n } from '../i18n/context'
import { useLocation } from '../lib/router'
import { MembersPanel } from '../sharing/MembersPanel'
import { ActivityPanel } from '../collab/ActivityList'
import { InlineText } from '../ui/InlineText'
import { useToast } from '../ui/toastContext'
import ui from '../ui/ui.module.css'
import css from './board.module.css'
import { ArchivedPanel } from './ArchivedPanel'
import { BoardColumns } from './BoardColumns'
import { BoardHeader } from './BoardHeader'
import { boardOrganize } from './boardOrganize'
import { CardModal } from './CardModal'
import { FilterBar } from './FilterBar'
import { EMPTY_FILTERS, filtersActive, findCard, matchesFilters } from './logic'
import { ShortcutsHelp } from './ShortcutsHelp'
import { TemplateDialog } from './TemplateDialog'
import { useBoard } from './useBoard'
import { useShortcuts } from './useShortcuts'

type Props = {
  boardId: number
  userId: number
  isGuest: boolean
  starred?: boolean
  onRenamed: (id: number, title: string) => void
  onDeleted: (id: number) => void
  onUpdated?: (id: number, changes: Partial<BoardSummary>) => void
  onCreated?: (board: BoardSummary) => void
}

/** The interactive board: header, filters, columns with drag and drop, card details. */
export function BoardView({ boardId, userId, isGuest, starred = false, onRenamed, onDeleted, onUpdated = () => {}, onCreated = () => {} }: Props) {
  const { board, loadError, actions } = useBoard(boardId)
  const { params } = useLocation()
  // The access-request email links here with ?members=1 so the admin lands on the panel.
  const [members, setMembers] = useState(params.get('members') === '1')
  const [activity, setActivity] = useState(false)
  const { t } = useI18n()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  // A notification links to ?board=..&card=..; open that card, also when the link changes.
  const cardParam = Number(params.get('card')) || null
  const [openCardId, setOpenCardId] = useState<number | null>(cardParam)
  const [seenParam, setSeenParam] = useState(cardParam)
  if (cardParam !== seenParam) {
    setSeenParam(cardParam)
    if (cardParam) setOpenCardId(cardParam)
  }
  const [composing, setComposing] = useState<number | null>(null)
  const [help, setHelp] = useState(false)
  const [picking, setPicking] = useState(false)
  const [chatting, setChatting] = useState(false)
  const [archivedOpen, setArchivedOpen] = useState(false)
  const [templating, setTemplating] = useState(false)
  const toast = useToast()
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
  if (!board) return <div className={css.skeleton} role="status" aria-label={t('board.loading')} />

  const cards = board.columns.flatMap((c) => c.cards)
  const shown = cards.filter((c) => matchesFilters(c, filters)).length
  const filtering = filtersActive(filters)
  const openCard = openCardId === null ? undefined : findCard(board, openCardId)?.card
  const organize = boardOrganize({
    board,
    actions,
    starred,
    toast,
    onUpdated,
    onCreated,
    openArchived: () => setArchivedOpen(true),
    openTemplate: () => setTemplating(true),
  })

  return (
    <section
      className={css.board}
      data-backdrop={board.background.kind !== 'none' || undefined}
      data-chat={chatting || undefined}
    >
      <Backdrop boardId={board.id} background={board.background} />
      <div className={css.boardTop}>
      <BoardHeader
        board={board}
        onRename={(title) => {
          if (actions.renameBoard(title)) onRenamed(board.id, title)
        }}
        onDelete={async () => {
          await boards.remove(board.id)
          onDeleted(board.id)
        }}
        onHelp={() => setHelp(true)}
        onBackground={() => setPicking(true)}
        onChat={() => setChatting(true)}
        onMembers={() => setMembers(true)}
        onActivity={() => setActivity(true)}
        starred={starred}
        onStar={organize.star}
        extraItems={organize.menuItems}
        onFocusDone={organize.onFocusDone}
      />
      {organize.note}
      <FilterBar
        filters={filters}
        onChange={setFilters}
        labels={board.labels}
        shown={shown}
        total={cards.length}
        searchRef={searchRef}
        me={userId}
      />
      {board.columns.length === 0 ? <p className={css.noResults}>{t('board.noColumns')}</p> : null}
      {filtering && shown === 0 ? (
        <p className={css.noResults}>
          {t('board.noMatches')}{' '}
          <button type="button" className={ui.linkButton} onClick={() => setFilters(EMPTY_FILTERS)}>
            {t('board.clearFilters')}
          </button>
        </p>
      ) : null}
      </div>
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
          members={board.members}
          actions={actions}
          onClose={() => setOpenCardId(null)}
          boardId={board.id}
          role={board.role}
          userId={userId}
        />
      ) : null}
      <ShortcutsHelp open={help} onClose={() => setHelp(false)} />
      <ArchivedPanel open={archivedOpen} onClose={() => setArchivedOpen(false)} boardId={board.id} actions={actions} />
      <TemplateDialog open={templating} onClose={() => setTemplating(false)} boardId={board.id} boardTitle={board.title} />
      <ChatPanel open={chatting} board={board} actions={actions} onClose={() => setChatting(false)} />
      <ActivityPanel
        open={activity}
        onClose={() => setActivity(false)}
        boardId={board.id}
        myEmail={board.members.find((m) => m.user_id === userId)?.email ?? null}
      />
      <MembersPanel
        open={members}
        onClose={() => setMembers(false)}
        board={board}
        userId={userId}
        isGuest={isGuest}
        onLeft={() => onDeleted(board.id)}
        onBoardChange={actions.setBoardInfo}
      />
      <BackgroundPicker
        open={picking}
        board={board}
        onClose={() => setPicking(false)}
        onChange={actions.setBackground}
      />
    </section>
  )
}

function AddColumn({ onAdd }: { onAdd: (title: string) => void }) {
  const { t } = useI18n()
  return (
    <div className={css.addColumn}>
      <InlineText
        value=""
        label={t('board.addColumn')}
        className={css.addColumnButton}
        inputClassName={`${ui.input} ${css.addColumnInput}`}
        onSave={onAdd}
      >
        <Plus size={16} aria-hidden="true" />
        {t('board.addColumn')}
      </InlineText>
    </div>
  )
}
