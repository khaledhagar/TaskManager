import { useState } from 'react'
import { auth, type User } from '../api/auth'
import { useI18n } from '../i18n/context'
import { Dialog } from '../ui/Dialog'
import dialog from '../ui/dialog.module.css'
import { Menu, type MenuItem } from '../ui/Menu'
import ui from '../ui/ui.module.css'
import { PasswordDialog } from './PasswordDialog'
import css from './shell.module.css'

type Props = {
  user: User
  onUserChange: (user: User) => void
  onSignedOut: () => void
  onUpgrade: () => void
}

/** Avatar button with account actions: password, guest upgrade, sign out, delete. */
export function AccountMenu({ user, onUserChange, onSignedOut, onUpgrade }: Props) {
  const { t } = useI18n()
  const [password, setPassword] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signOut() {
    await auth.signOut()
    onSignedOut()
  }

  async function deleteAccount() {
    try {
      await auth.deleteAccount()
      onSignedOut()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const items: MenuItem[] = [
    { kind: 'note', label: user.email ?? t('account.guest') },
    user.is_guest
      ? { kind: 'action', label: t('shell.saveBoards'), onSelect: onUpgrade }
      : {
          kind: 'action',
          label: t(user.has_password ? 'account.changePassword' : 'account.setPassword'),
          onSelect: () => setPassword(true),
        },
    { kind: 'separator' },
    { kind: 'action', label: t('account.signOut'), onSelect: signOut },
    { kind: 'action', label: t('account.delete'), danger: true, onSelect: () => setConfirmDelete(true) },
  ]

  return (
    <>
      <Menu
        label={t('account.menu')}
        align="end"
        triggerClassName={css.avatar}
        trigger={<span aria-hidden="true">{(user.email ?? 'G').charAt(0).toUpperCase()}</span>}
        items={items}
      />
      <PasswordDialog
        open={password}
        onClose={() => setPassword(false)}
        hasPassword={user.has_password}
        onSaved={onUserChange}
      />
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('account.deleteTitle')}
      >
        <p>{t('account.deleteBody')}</p>
        {error ? (
          <p className={ui.alert} role="alert">
            {error}
          </p>
        ) : null}
        <div className={dialog.actions}>
          <button
            type="button"
            className={`${ui.button} ${ui.secondary}`}
            onClick={() => setConfirmDelete(false)}
          >
            {t('ui.cancel')}
          </button>
          <button type="button" className={`${ui.button} ${ui.danger}`} onClick={deleteAccount}>
            {t('account.delete')}
          </button>
        </div>
      </Dialog>
    </>
  )
}
