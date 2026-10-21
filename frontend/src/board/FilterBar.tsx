import { Search } from 'lucide-react'
import type { Ref } from 'react'
import type { Label, Priority } from '../api/boards'
import { useI18n } from '../i18n/context'
import ui from '../ui/ui.module.css'
import { MicButton } from '../voice/MicButton'
import css from './board.module.css'
import { PRIORITIES, priorityLabel } from './display'
import { EMPTY_FILTERS, filtersActive, type Filters } from './logic'

type Props = {
  filters: Filters
  onChange: (filters: Filters) => void
  labels: Label[]
  shown: number
  total: number
  searchRef: Ref<HTMLInputElement>
  me: number
}

/** Search and filters; the count tells how many cards are visible. */
export function FilterBar({ filters, onChange, labels, shown, total, searchRef, me }: Props) {
  const { t } = useI18n()
  const set = (changes: Partial<Filters>) => onChange({ ...filters, ...changes })
  const active = filtersActive(filters)

  return (
    <div className={css.filters}>
      <label className={css.search}>
        <Search size={16} aria-hidden="true" />
        <input
          ref={searchRef}
          type="search"
          dir="auto"
          aria-label={t('filter.search')}
          placeholder={t('filter.search')}
          value={filters.text}
          onChange={(e) => set({ text: e.target.value })}
          onKeyDown={(e) => e.key === 'Escape' && set({ text: '' })}
        />
        <MicButton value={filters.text} onChange={(text) => set({ text })} maxLength={200} />
        <kbd className={css.kbd} aria-hidden="true">
          /
        </kbd>
      </label>
      <select
        aria-label={t('filter.byLabel')}
        className={css.filterSelect}
        value={filters.labelId ?? ''}
        onChange={(e) => set({ labelId: e.target.value ? Number(e.target.value) : null })}
      >
        <option value="">{t('filter.allLabels')}</option>
        {labels.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <select
        aria-label={t('filter.byPriority')}
        className={css.filterSelect}
        value={filters.priority ?? ''}
        onChange={(e) => set({ priority: (e.target.value || null) as Priority | null })}
      >
        <option value="">{t('filter.anyPriority')}</option>
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {priorityLabel(p)}
          </option>
        ))}
      </select>
      <select
        aria-label={t('filter.byStatus')}
        className={css.filterSelect}
        value={filters.assignee === null ? filters.status : 'mine'}
        onChange={(e) =>
          e.target.value === 'mine'
            ? set({ status: 'all', assignee: me })
            : set({ status: e.target.value as Filters['status'], assignee: null })
        }
      >
        <option value="all">{t('filter.allCards')}</option>
        <option value="open">{t('filter.open')}</option>
        <option value="done">{t('filter.completed')}</option>
        <option value="overdue">{t('filter.overdue')}</option>
        <option value="mine">{t('filter.mine')}</option>
      </select>
      {active ? (
        <>
          <span className={ui.hint} role="status">
            {t('filter.showing', { shown, total })}
          </span>
          <button type="button" className={ui.linkButton} onClick={() => onChange(EMPTY_FILTERS)}>
            {t('board.clearFilters')}
          </button>
        </>
      ) : null}
    </div>
  )
}
