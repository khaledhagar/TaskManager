import { ChevronDown } from 'lucide-react'
import type { BoardSummary } from '../api/boards'
import { Menu } from '../ui/Menu'
import css from './shell.module.css'

type Props = { boards: BoardSummary[]; selectedId?: number; onSelect: (id: number) => void }

/** Current board name; opens a list of all boards. */
export function BoardSwitcher({ boards, selectedId, onSelect }: Props) {
  const current = boards.find((b) => b.id === selectedId)
  return (
    <Menu
      label="Switch board"
      triggerClassName={css.switcher}
      trigger={
        <>
          <span className={css.switcherName}>{current?.title ?? 'Boards'}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </>
      }
      items={[
        { kind: 'note', label: 'Your boards' },
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
