import { useI18n } from '../i18n/context'
import type { Key } from '../i18n/messages'
import css from './auth.module.css'

const COLUMNS: { title: Key; cards: Key[] }[] = [
  { title: 'wall.todo', cards: ['wall.card1', 'wall.card2'] },
  { title: 'wall.inProgress', cards: ['wall.card3'] },
  { title: 'wall.done', cards: ['wall.card4'] },
]

/** Decorative miniature board: one card travels from To Do to Done. */
export function WallPreview() {
  const { t } = useI18n()
  return (
    <div className={css.wall} aria-hidden="true">
      <div className={css.wallBoard}>
        {COLUMNS.map((column) => (
          <div key={column.title} className={css.wallColumn}>
            <span className={css.wallColumnTitle}>{t(column.title)}</span>
            {column.cards.map((card) => (
              <span key={card} className={css.wallCard}>
                {t(card)}
              </span>
            ))}
          </div>
        ))}
        <span className={`${css.wallCard} ${css.traveller}`}>{t('wall.traveller')}</span>
      </div>
    </div>
  )
}
