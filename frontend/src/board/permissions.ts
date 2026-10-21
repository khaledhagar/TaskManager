import type { Role } from '../api/boards'
import type { Key } from '../i18n/messages'

const RANK: Record<Role, number> = { viewer: 0, updater: 1, editor: 2, admin: 3 }

/** Whether `role` may do something that needs `need` (same table as the server). */
export const can = (role: Role, need: Role) => RANK[role] >= RANK[need]

/** The message for a refused action; mirrors the server's 403 texts. */
export function deniedKey(role: Role, need: Role): Key {
  if (need === 'admin') return 'access.adminOnly'
  return role === 'viewer' ? 'access.viewOnly' : 'access.fullAccess'
}

/** Changing only these card or checklist fields needs "Can update tasks"; anything else needs full access. */
export const needFor = (changes: object, light: string): Role =>
  Object.keys(changes).every((key) => key === light) ? 'updater' : 'editor'
