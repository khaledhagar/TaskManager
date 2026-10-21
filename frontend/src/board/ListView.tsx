import { ArrowDown, ArrowUp } from 'lucide-react'
import { useState } from 'react'
import type { Board } from '../api/boards'
import { useI18n } from '../i18n/context'
import type { Key } from '../i18n/messages'
import cardCss from './card.module.css'
import { LABEL_SWATCH, priorityLabel } from './display'
import css from './list.module.css'
import { listRows, nextSort, sortRows, type Sort, type SortKey } from './listLogic'
import { dueLabel, dueStatus, type Filters } from './logic'

type Props = { board: Board; filters: Filters; onOpenCard: (id: number) => void }

/** Every card in one sortable table, following the board's filters; a title opens the card. */
export function ListView({ board, filters, onOpenCard }: Props) {
  const { t } = useI18n()
  const [sort, setSort] = useState<Sort>({ key: 'column', dir: 'asc' })
  const rows = sortRows(listRows(board, filters), sort)
  const people = new Map(board.members.map((m) => [m.user_id, m.email ?? '']))
  const labels = new Map(board.labels.map((l) => [l.id, l]))

  function header(key: SortKey, label: Key) {
    const active = sort.key === key
    const Arrow = sort.dir === 'asc' ? ArrowUp : ArrowDown
    return (
      <th scope="col" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button type="button" className={css.sort} onClick={() => setSort((s) => nextSort(s, key))}>
          {t(label)}
          {active ? <Arrow size={14} aria-hidden="true" /> : null}
        </button>
      </th>
    )
  }

  return (
    <div className={css.wrap} role="region" aria-label={t('list.caption', { board: board.title })} tabIndex={0}>
      <table className={css.table}>
        <thead>
          <tr>
            {header('title', 'list.title')}
            {header('column', 'list.column')}
            {header('priority', 'list.priority')}
            {header('due', 'list.due')}
            <th scope="col">{t('list.assignees')}</th>
            <th scope="col">{t('list.labels')}</th>
            {header('done', 'list.status')}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ card, column }) => (
            <tr key={card.id} data-completed={card.completed || undefined}>
              <td>
                <button type="button" className={css.open} dir="auto" onClick={() => onOpenCard(card.id)}>
                  {card.title}
                </button>
              </td>
              <td dir="auto">{column.title}</td>
              <td>
                <span className={cardCss.priority} data-priority={card.priority}>
                  {priorityLabel(card.priority)}
                </span>
              </td>
              <td>
                {card.due_date ? (
                  <span className={cardCss.due} data-status={dueStatus(card.due_date, card.completed)}>
                    {dueLabel(card.due_date)}
                  </span>
                ) : null}
              </td>
              <td className={css.people}>{card.assignee_ids.map((id) => people.get(id)).join(', ')}</td>
              <td>
                <span className={css.labels}>
                  {card.label_ids.map((id) => labels.get(id)).filter((l) => l !== undefined).map((l) => (
                    <span key={l.id} className={cardCss.label} dir="auto">
                      <span className={cardCss.swatch} style={{ background: LABEL_SWATCH[l.color] }} />
                      {l.name}
                    </span>
                  ))}
                </span>
              </td>
              <td>{t(card.completed ? 'list.done' : 'list.open')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
