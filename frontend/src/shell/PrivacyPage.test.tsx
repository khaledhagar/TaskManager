import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { PrivacyPage } from './PrivacyPage'

describe('Privacy page (T-810)', () => {
  test('explains the data kept, the services used and how to delete it', () => {
    render(<PrivacyPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy policy' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Google sign-in' })).toBeInTheDocument()
    expect(screen.getByText(/OpenRouter/)).toBeInTheDocument()
    expect(screen.getByText(/delete your account at any time/)).toBeInTheDocument()
  })

  test('gives a contact email and a way back to the app', () => {
    render(<PrivacyPage />)
    expect(screen.getByRole('link', { name: 'datasharingks@gmail.com' })).toHaveAttribute(
      'href',
      'mailto:datasharingks@gmail.com',
    )
    expect(screen.getByRole('link', { name: /Task Manager/ })).toHaveAttribute('href', '/')
  })
})
