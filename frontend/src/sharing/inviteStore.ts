/** The invite token from the link, kept in this browser while the user signs in or signs up. */

const KEY = 'inviteToken'

/** The invite token from the link, or one saved before the user went to sign in. */
export function inviteToken(): string {
  const fromLink = new URLSearchParams(location.hash.slice(1)).get('token')
  if (fromLink) return fromLink
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

/** Remember the invite so sign in, sign up and email verification can come back to it. */
export function savedInvite(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function remember(token: string | null) {
  try {
    if (token) localStorage.setItem(KEY, token)
    else localStorage.removeItem(KEY)
  } catch {
    // Private mode: the user can open the link again after signing in.
  }
}
