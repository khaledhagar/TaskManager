import { t } from '../i18n/language'

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
