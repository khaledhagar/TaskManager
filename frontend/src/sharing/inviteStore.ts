/** Where to return after sign-in: an invitation link, or a public board to join. */

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

const RETURN = 'returnTo'

/** A public board page to come back to after signing in (to join it). */
export function rememberReturn(path: string) {
  try {
    localStorage.setItem(RETURN, path)
  } catch {
    // Private mode: the visitor can open the link again.
  }
}

/** The page saved by `rememberReturn`, cleared once read. */
export function takeReturn(): string | null {
  try {
    const path = localStorage.getItem(RETURN)
    localStorage.removeItem(RETURN)
    return path
  } catch {
    return null
  }
}
