import type { Key } from '../i18n/messages'
import { COMMON_PASSWORDS } from './commonPasswords'

export type Strength = 'weak' | 'medium' | 'strong'

const KINDS = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/]

/** Facts the rules use; lengths count characters (code points), as Python does. */
function measure(password: string, email: string) {
  const chars = [...password]
  const name = email.split('@')[0].toLowerCase()
  return {
    length: chars.length,
    kinds: KINDS.filter((kind) => kind.test(password)).length,
    common: COMMON_PASSWORDS.has(password.toLowerCase()),
    hasEmail: name.length >= 4 && password.toLowerCase().includes(name),
    distinct: new Set(chars).size,
  }
}

/** Rate a password; mirrors `backend/app/passwords.py` (checked against the same examples). */
export function strength(password: string, email = ''): Strength {
  const m = measure(password, email)
  if (m.length < 8 || m.common || m.hasEmail || m.distinct < 5) return 'weak'
  if ((m.length >= 12 && m.kinds >= 3) || (m.length >= 16 && m.kinds >= 2)) return 'strong'
  if ((m.length >= 10 && m.kinds >= 2) || (m.length >= 8 && m.kinds >= 3)) return 'medium'
  return 'weak'
}

/** The one thing to change next, or null for a strong password. */
export function strengthHint(password: string, email = ''): Key | null {
  const m = measure(password, email)
  if (m.length < 8) return 'validate.passwordShort'
  if (m.common) return 'strength.common'
  if (m.hasEmail) return 'strength.email'
  if (m.distinct < 5) return 'strength.repeated'
  const level = strength(password, email)
  if (level === 'weak') return 'strength.more'
  return level === 'medium' ? 'strength.better' : null
}
