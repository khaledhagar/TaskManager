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
  const title = current?.title ?? t('shell.boards')
  const own = boards.filter((b) => b.role === 'admin')
  const shared = boards.filter((b) => b.role !== 'admin')
  const item = (b: BoardSummary) => ({
    kind: 'action' as const,
    label: b.title,
    checked: b.id === selectedId,
    onSelect: () => onSelect(b.id),
  })
  // The name starts with the text people see, so voice control can find it (WCAG 2.5.3).
  return (
    <Menu
      label={t('shell.switchBoard', { title })}
      triggerClassName={css.switcher}
      className={css.switcherMenu}
      trigger={
        <>
          <span className={css.switcherName} dir="auto">{title}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </>
      }
      items={[
        { kind: 'note', label: t('shell.yourBoards') },
        ...own.map(item),
        ...(shared.length ? [{ kind: 'note' as const, label: t('shell.sharedBoards') }, ...shared.map(item)] : []),
      ]}
    />
  )
}
