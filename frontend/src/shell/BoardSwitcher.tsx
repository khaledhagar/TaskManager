import { ChevronDown } from 'lucide-react'
import type { BoardSummary } from '../api/boards'
import type { Workspace } from '../api/workspaces'
import { useI18n } from '../i18n/context'
import { navigate } from '../lib/router'
import { Menu } from '../ui/Menu'
import { boardSections } from './boardSections'
import css from './shell.module.css'

type Props = { boards: BoardSummary[]; workspaces?: Workspace[]; selectedId?: number; onSelect: (id: number) => void }

/** Current board name; opens a list of all boards. */
export function BoardSwitcher({ boards, workspaces = [], selectedId, onSelect }: Props) {
  const current = boards.find((b) => b.id === selectedId)
  const { t } = useI18n()
  const title = current?.title ?? t('shell.boards')
  const { starred, workspaces: groups, own, shared, archived } = boardSections(boards, workspaces)
  const section = (label: string, list: BoardSummary[]) =>
    list.length ? [{ kind: 'note' as const, label }, ...list.map(item)] : []
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
        // The start page, also reachable here on phones where the header has no room for its button.
        { kind: 'action', label: t('shell.allBoards'), checked: selectedId === undefined, onSelect: () => navigate('/') },
        { kind: 'separator' },
        ...section(t('shell.starred'), starred),
        ...groups.flatMap((g) => section(g.workspace.name, g.boards)),
        ...section(t('shell.yourBoards'), own),
        ...section(t('shell.sharedBoards'), shared),
        ...section(t('shell.archivedBoards'), archived),
      ]}
    />
  )
}
