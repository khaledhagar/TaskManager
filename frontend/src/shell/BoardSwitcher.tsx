import { ChevronDown } from 'lucide-react'
import type { BoardSummary } from '../api/boards'
import { useI18n } from '../i18n/context'
import { Menu } from '../ui/Menu'
import css from './shell.module.css'

type Props = { boards: BoardSummary[]; selectedId?: number; onSelect: (id: number) => void }

/** Current board name; opens a list of all boards. */
export function BoardSwitcher({ boards, selectedId, onSelect }: Props) {
  const current = boards.find((b) => b.id === selectedId)
  const { t } = useI18n()
  return (
    <Menu
      label={t('shell.switchBoard')}
      triggerClassName={css.switcher}
      trigger={
        <>
          <span className={css.switcherName} dir="auto">{current?.title ?? t('shell.boards')}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </>
      }
      items={[
        { kind: 'note', label: t('shell.yourBoards') },
        ...boards.map((b) => ({
          kind: 'action' as const,
          label: b.title,
          checked: b.id === selectedId,
          onSelect: () => onSelect(b.id),
        })),
      ]}
    />
  )
}
