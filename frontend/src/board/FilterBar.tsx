import { Search } from 'lucide-react'
import type { Ref } from 'react'
import type { Label, Priority } from '../api/boards'
import ui from '../ui/ui.module.css'
import css from './board.module.css'
import { PRIORITIES, PRIORITY_LABEL } from './display'
import { EMPTY_FILTERS, filtersActive, type Filters } from './logic'

type Props = {
  filters: Filters
  onChange: (filters: Filters) => void
  labels: Label[]
  shown: number
  total: number
  searchRef: Ref<HTMLInputElement>
}

/** Search and filters; the count tells how many cards are visible. */
export function FilterBar({ filters, onChange, labels, shown, total, searchRef }: Props) {
  const set = (changes: Partial<Filters>) => onChange({ ...filters, ...changes })
  const active = filtersActive(filters)

  return (
    <div className={css.filters}>
      <label className={css.search}>
        <Search size={16} aria-hidden="true" />
        <input
          ref={searchRef}
          type="search"
          aria-label="Search cards"
          placeholder="Search cards"
          value={filters.text}
          onChange={(e) => set({ text: e.target.value })}
          onKeyDown={(e) => e.key === 'Escape' && set({ text: '' })}
        />
        <kbd className={css.kbd} aria-hidden="true">
          /
        </kbd>
      </label>
      <select
        aria-label="Filter by label"
        className={css.filterSelect}
        value={filters.labelId ?? ''}
        onChange={(e) => set({ labelId: e.target.value ? Number(e.target.value) : null })}
      >
        <option value="">All labels</option>
        {labels.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by priority"
        className={css.filterSelect}
        value={filters.priority ?? ''}
        onChange={(e) => set({ priority: (e.target.value || null) as Priority | null })}
      >
        <option value="">Any priority</option>
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABEL[p]}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by status"
        className={css.filterSelect}
        value={filters.status}
        onChange={(e) => set({ status: e.target.value as Filters['status'] })}
      >
        <option value="all">All cards</option>
        <option value="open">Open</option>
        <option value="done">Completed</option>
      </select>
      {active ? (
        <>
          <span className={ui.hint} role="status">
            Showing {shown} of {total} cards. Drag and drop is paused while filtering.
          </span>
          <button type="button" className={ui.linkButton} onClick={() => onChange(EMPTY_FILTERS)}>
            Clear filters
          </button>
        </>
      ) : null}
    </div>
  )
}
