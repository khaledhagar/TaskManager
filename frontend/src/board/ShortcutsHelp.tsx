import { useI18n } from '../i18n/context'
import type { Key } from '../i18n/messages'
import { Dialog } from '../ui/Dialog'
import css from './board.module.css'

/** Each shortcut: the key (plain text or a message) and what it does. */
const SHORTCUTS: [string | Key, Key][] = [
  ['N', 'shortcuts.newCard'],
  ['/', 'shortcuts.search'],
  ['?', 'shortcuts.help'],
  ['Esc', 'shortcuts.close'],
  ['shortcuts.space', 'shortcuts.pickUp'],
  ['shortcuts.arrows', 'shortcuts.move'],
  ['shortcuts.enter', 'shortcuts.open'],
]

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n()
  return (
    <Dialog open={open} onClose={onClose} title={t('board.shortcuts')}>
      <dl className={css.shortcuts}>
        {SHORTCUTS.map(([key, text]) => (
          <div key={key} className={css.shortcut}>
            <dt>
              <kbd className={css.kbd}>{key.startsWith('shortcuts.') ? t(key as Key) : key}</kbd>
            </dt>
            <dd>{t(text)}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  )
}
