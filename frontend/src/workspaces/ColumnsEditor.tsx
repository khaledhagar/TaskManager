import { Plus, X } from 'lucide-react'
import { useI18n } from '../i18n/context'
import ui from '../ui/ui.module.css'
import { MAX_COLUMNS } from './columns'
import css from './editor.module.css'

type Props = { board: string; columns: string[]; onChange: (columns: string[]) => void }

/** The column names a new board starts with: rename, remove (one stays) or add (up to 20). */
export function ColumnsEditor({ board, columns, onChange }: Props) {
  const { t } = useI18n()
  const set = (i: number, value: string) => onChange(columns.map((c, j) => (j === i ? value : c)))
  return (
    <fieldset className={css.columns}>
      <legend className={ui.hint}>{t('columns.label', { board: board.trim() || '...' })}</legend>
      {columns.map((name, i) => (
        <span key={i} className={css.chip}>
          <input
            className={css.chipInput}
            dir="auto"
            maxLength={200}
            aria-label={t('columns.name', { number: i + 1 })}
            value={name}
            onChange={(e) => set(i, e.target.value)}
          />
          {columns.length > 1 ? (
            <button
              type="button"
              className={css.chipRemove}
              aria-label={t('columns.remove', { name: name || i + 1 })}
              onClick={() => onChange(columns.filter((_, j) => j !== i))}
            >
              <X size={12} aria-hidden="true" />
            </button>
          ) : null}
        </span>
      ))}
      {columns.length < MAX_COLUMNS ? (
        <button type="button" className={css.chipAdd} onClick={() => onChange([...columns, ''])}>
          <Plus size={12} aria-hidden="true" />
          {t('columns.add')}
        </button>
      ) : null}
    </fieldset>
  )
}
