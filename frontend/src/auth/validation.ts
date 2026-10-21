import { t } from '../i18n/language'
import { strength } from './strength'

/** Client-side checks matching the backend rules; the server still validates everything. */
export function emailError(email: string): string | null {
  if (!email.trim()) return t('validate.emailMissing')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return t('validate.emailInvalid')
  return null
}

export function passwordError(password: string): string | null {
  if (password.length < 8) return t('validate.passwordShort')
  if (password.length > 128) return t('validate.passwordLong')
  return null
}

/** Checks a new password (sign up, reset, change, upgrade): Weak ones are refused; the meter says why. */
export function newPasswordError(password: string, email = ''): string | null {
  if (password.length > 128) return t('validate.passwordLong')
  return strength(password, email) === 'weak' ? t('strength.tooWeak') : null
}
