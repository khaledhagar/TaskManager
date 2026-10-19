import css from './auth.module.css'

const COLUMNS = [
  { title: 'To Do', cards: ['Write launch announcement', 'Set up analytics'] },
  { title: 'In Progress', cards: ['Design pricing page'] },
  { title: 'Done', cards: ['Choose brand colors'] },
]

/** Decorative miniature board: one card travels from To Do to Done. */
export function WallPreview() {
  return (
    <div className={css.wall} aria-hidden="true">
      <div className={css.wallBoard}>
        {COLUMNS.map((column) => (
          <div key={column.title} className={css.wallColumn}>
            <span className={css.wallColumnTitle}>{column.title}</span>
            {column.cards.map((card) => (
              <span key={card} className={css.wallCard}>
                {card}
              </span>
            ))}
          </div>
        ))}
        <span className={`${css.wallCard} ${css.traveller}`}>Ship it</span>
      </div>
    </div>
  )
}
