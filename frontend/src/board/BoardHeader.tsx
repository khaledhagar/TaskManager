import { MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import type { Board } from '../api/boards'
import { useI18n } from '../i18n/context'
import { FocusTimer } from '../timer/FocusTimer'
import { Dialog } from '../ui/Dialog'
import dialog from '../ui/dialog.module.css'
import { InlineText } from '../ui/InlineText'
import { Menu } from '../ui/Menu'
import ui from '../ui/ui.module.css'
import css from './board.module.css'
import { progress } from './logic'

type Props = {
  board: Board
  onRename: (title: string) => void
  onDelete: () => Promise<void>
  onHelp: () => void
  onBackground: () => void
}

/** Board title (click to rename), completion progress and board options. */
export function BoardHeader({ board, onRename, onDelete, onHelp, onBackground }: Props) {
  const { t } = useI18n()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { done, total, percent } = progress(board)

  async function remove() {
    try {
      await onDelete()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className={css.boardHead}>
      <h1 className={css.boardTitle}>
        <InlineText
          value={board.title}
          label={t('board.rename', { title: board.title })}
          className={css.boardTitleButton}
          inputClassName={css.boardTitleInput}
          onSave={onRename}
        >
          {board.title}
        </InlineText>
      </h1>
      <div className={css.progress}>
        <div
          className={css.bar}
          role="progressbar"
          aria-label={t('board.completed')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
        <span className={ui.hint}>{total ? t('board.progress', { done, total }) : t('board.noCards')}</span>
      </div>
      <FocusTimer />
      <Menu
        label={t('board.options')}
        align="end"
        triggerClassName={ui.iconButton}
        trigger={<MoreHorizontal size={18} aria-hidden="true" />}
        items={[
          { kind: 'action', label: t('board.changeBackground'), onSelect: onBackground },
          { kind: 'action', label: t('board.shortcuts'), onSelect: onHelp },
          { kind: 'separator' },
          { kind: 'action', label: t('board.delete'), danger: true, onSelect: () => setConfirming(true) },
        ]}
      />
      <Dialog open={confirming} onClose={() => setConfirming(false)} title={t('board.deleteTitle')}>
        <p>{t('board.deleteBody', { title: board.title })}</p>
        {error ? (
          <p className={ui.alert} role="alert">
            {error}
          </p>
        ) : null}
        <div className={dialog.actions}>
          <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={() => setConfirming(false)}>
            {t('ui.cancel')}
          </button>
          <button type="button" className={`${ui.button} ${ui.danger}`} onClick={remove}>
            {t('board.delete')}
          </button>
        </div>
      </Dialog>
    </div>
  )
}
