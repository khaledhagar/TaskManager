/// <reference types="node" />
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { COMMON_PASSWORDS } from './commonPasswords'
import { PasswordStrength } from './PasswordStrength'
import { strength, strengthHint } from './strength'
import { newPasswordError } from './validation'

const backend = join(__dirname, '../../../backend')
type Case = { password: string; email: string; expected: string }
const cases: Case[] = JSON.parse(readFileSync(join(backend, 'tests/password_cases.json'), 'utf-8'))

describe('password strength rules (T-501, T-502)', () => {
  test.each(cases)('$password is $expected', ({ password, email, expected }) => {
    expect(strength(password, email)).toBe(expected)
  })

  test('the common-password list matches the backend copy', () => {
    const words = readFileSync(join(backend, 'app/common_passwords.txt'), 'utf-8').split(/\s+/).filter(Boolean)
    expect([...COMMON_PASSWORDS]).toEqual(words)
  })

  test('a new password must not be weak; medium and strong pass', () => {
    expect(newPasswordError('short')).toBe('This password is too weak.')
    expect(newPasswordError('password123')).toBe('This password is too weak.')
    expect(newPasswordError('khaled2026!x', 'khaled@example.com')).toBe('This password is too weak.')
    expect(newPasswordError('correct-horse')).toBeNull()
    expect(newPasswordError('Correct-Horse-42')).toBeNull()
  })

  test.each([
    ['short', '', 'validate.passwordShort'],
    ['password123', '', 'strength.common'],
    ['khaled2026!x', 'khaled@example.com', 'strength.email'],
    ['aaaaaaaaaa1', '', 'strength.repeated'],
    ['abcdefghij', '', 'strength.more'],
    ['correct-horse', '', 'strength.better'],
    ['Correct-Horse-42', '', null],
  ])('hint for %s', (password, email, hint) => {
    expect(strengthHint(password, email)).toBe(hint)
  })
})

describe('strength meter (T-506)', () => {
  test('shows nothing until something is typed', () => {
    const { container } = render(<PasswordStrength password="" />)
    expect(container).toBeEmptyDOMElement()
  })

  test.each([
    ['abcdefgh', 'Weak', 'Use at least 10 characters with letters and numbers, or add symbols.'],
    ['correct-horse', 'Medium', 'Use 12 or more characters with numbers and symbols to make it strong.'],
    ['Correct-Horse-42', 'Strong', null],
  ])('%s is shown as %s with a hint', (password, word, hint) => {
    render(<PasswordStrength password={password} />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(`Password strength: ${word}`)
    if (hint) expect(status).toHaveTextContent(hint)
    expect(screen.getByRole('meter', { name: 'Password strength' })).toHaveAttribute(
      'aria-valuetext',
      word,
    )
  })

  test('uses the email to spot a weak password', () => {
    render(<PasswordStrength password="khaled2026!x" email="khaled@example.com" />)
    expect(screen.getByRole('status')).toHaveTextContent('Weak')
  })
})
