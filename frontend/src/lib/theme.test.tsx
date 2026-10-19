import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { initialTheme, useTheme } from './theme'

function systemPrefersDark(dark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: dark, media: query }))
}

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

describe('theme (T-203)', () => {
  test('follows the system preference when nothing is saved', () => {
    systemPrefersDark(true)
    expect(initialTheme()).toBe('dark')
    systemPrefersDark(false)
    expect(initialTheme()).toBe('light')
  })

  test('a saved choice wins over the system', () => {
    systemPrefersDark(true)
    localStorage.setItem('theme', 'light')
    expect(initialTheme()).toBe('light')
  })

  test('toggle switches, applies and saves the theme', () => {
    systemPrefersDark(false)
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
    act(() => result.current.toggle())
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
  })
})
