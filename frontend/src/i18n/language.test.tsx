import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { api } from '../api/client'
import { useI18n } from './context'
import { I18nProvider, LanguageButton } from './I18n'
import { applyLanguage, initialLanguage } from './language'

function Progress() {
  const { t } = useI18n()
  return <p>{t('board.progress', { done: 1, total: 2 })}</p>
}

function renderApp() {
  return render(
    <I18nProvider>
      <LanguageButton />
      <Progress />
    </I18nProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  applyLanguage('en')
})
afterEach(() => vi.unstubAllGlobals())

describe('language choice (T-243)', () => {
  test('starts from the browser language when nothing is saved', () => {
    vi.stubGlobal('navigator', { language: 'ar-EG' })
    expect(initialLanguage()).toBe('ar')
    vi.stubGlobal('navigator', { language: 'fr-FR' })
    expect(initialLanguage()).toBe('en')
  })

  test('a saved choice wins; unknown saved values are ignored', () => {
    vi.stubGlobal('navigator', { language: 'en-US' })
    localStorage.setItem('language', 'ar')
    expect(initialLanguage()).toBe('ar')
    localStorage.setItem('language', 'xx')
    expect(initialLanguage()).toBe('en')
  })

  test('the button switches text, sets html lang and dir, and saves the choice', async () => {
    renderApp()
    expect(screen.getByText('1 of 2 done')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'العربية' }))
    expect(screen.getByText('تم إنجاز 1 من 2')).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('ar')
    expect(document.documentElement.dir).toBe('rtl')
    expect(localStorage.getItem('language')).toBe('ar')
    await userEvent.click(screen.getByRole('button', { name: 'English' }))
    expect(document.documentElement.dir).toBe('ltr')
  })

  test('the choice is restored on reload', () => {
    localStorage.setItem('language', 'ar')
    applyLanguage(initialLanguage())
    renderApp()
    expect(screen.getByText('تم إنجاز 1 من 2')).toBeInTheDocument()
  })
})

describe('Accept-Language (T-244)', () => {
  test('api requests send the current language', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    applyLanguage('ar')
    await api('/auth/me')
    expect(fetchMock.mock.calls[0][1].headers['Accept-Language']).toBe('ar')
  })
})
