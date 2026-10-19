import { Dialog } from '../ui/Dialog'
import css from './board.module.css'

const SHORTCUTS = [
  ['N', 'Add a card to the first column'],
  ['/', 'Search cards'],
  ['?', 'Show these shortcuts'],
  ['Esc', 'Close a window or cancel editing'],
  ['Space', 'Pick up or drop a focused card or column'],
  ['Arrow keys', 'Move a picked-up card or column'],
  ['Enter', 'Open the focused card'],
]

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts">
      <dl className={css.shortcuts}>
        {SHORTCUTS.map(([key, text]) => (
          <div key={key} className={css.shortcut}>
            <dt>
              <kbd className={css.kbd}>{key}</kbd>
            </dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  )
}
