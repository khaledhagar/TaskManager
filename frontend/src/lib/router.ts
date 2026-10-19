import { useSyncExternalStore } from 'react'

/** Minimal client-side routing over the History API. */
export function navigate(to: string, { replace = false } = {}) {
  if (replace) history.replaceState(null, '', to)
  else history.pushState(null, '', to)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function subscribe(callback: () => void) {
  window.addEventListener('popstate', callback)
  return () => window.removeEventListener('popstate', callback)
}

const snapshot = () => location.pathname + location.search

/** Current path and query parameters; re-renders on navigation. */
export function useLocation() {
  const href = useSyncExternalStore(subscribe, snapshot)
  const url = new URL(href, location.origin)
  return { path: url.pathname, params: url.searchParams }
}
