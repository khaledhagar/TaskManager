import { useState } from 'react'

export type Theme = 'light' | 'dark'
const KEY = 'theme'

function saved(): Theme | null {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

/** The saved theme, or the system preference when nothing is saved. */
export function initialTheme(): Theme {
  return saved() ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
}

/** Theme state that applies to the page and is remembered per browser. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // Storage can be blocked; the theme still applies for this visit.
    }
    setTheme(next)
  }
  return { theme, toggle }
}
