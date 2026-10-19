import css from './logo.module.css'

/** Three columns of descending height: a board at a glance. */
export function Logo({ inverted = false, collapsible = false }: { inverted?: boolean; collapsible?: boolean }) {
  return (
    <span className={`${css.logo} ${inverted ? css.inverted : ''} ${collapsible ? css.collapsible : ''}`}>
      <svg className={css.mark} viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#032147" />
        <rect x="6" y="7" width="5" height="18" rx="2" fill="#209dd7" />
        <rect x="13.5" y="7" width="5" height="12" rx="2" fill="#ecad0a" />
        <rect x="21" y="7" width="5" height="8" rx="2" fill="#753991" />
      </svg>
      <span className={css.word}>Task Manager</span>
    </span>
  )
}
