/** Client-side checks matching the backend rules; the server still validates everything. */
export function emailError(email: string): string | null {
  if (!email.trim()) return 'Enter your email address.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a valid email address.'
  return null
}

export function passwordError(password: string): string | null {
  if (password.length < 8) return 'Use at least 8 characters.'
  if (password.length > 128) return 'Use 128 characters or fewer.'
  return null
}
