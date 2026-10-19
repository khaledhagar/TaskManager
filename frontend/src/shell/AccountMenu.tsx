import { useState } from 'react'
import { auth, type User } from '../api/auth'
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
    { kind: 'note', label: user.email ?? 'Guest account' },
    user.is_guest
      ? { kind: 'action', label: 'Save your boards', onSelect: onUpgrade }
      : {
          kind: 'action',
          label: user.has_password ? 'Change password' : 'Set password',
          onSelect: () => setPassword(true),
        },
    { kind: 'separator' },
    { kind: 'action', label: 'Sign out', onSelect: signOut },
    { kind: 'action', label: 'Delete account', danger: true, onSelect: () => setConfirmDelete(true) },
  ]

  return (
    <>
      <Menu
        label="Account"
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
        title="Delete your account?"
      >
        <p>This permanently deletes your account and all your boards. You can't undo this.</p>
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
            Cancel
          </button>
          <button type="button" className={`${ui.button} ${ui.danger}`} onClick={deleteAccount}>
            Delete account
          </button>
        </div>
      </Dialog>
    </>
  )
}
