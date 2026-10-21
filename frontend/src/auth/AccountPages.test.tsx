import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { auth, type User } from '../api/auth'
import { ApiError } from '../api/client'
import { CheckInbox, ForgotPassword, ResetPassword, VerifyEmail } from './AccountPages'

vi.mock('../api/auth', async (original) => {
  const actual = await original<typeof import('../api/auth')>()
  return { ...actual, auth: { resend: vi.fn(), forgot: vi.fn(), reset: vi.fn(), verify: vi.fn() } }
})

const user = { id: 1, email: 'a@example.com', is_guest: false } as User

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.useRealTimers())

describe('check inbox (T-218)', () => {
  test('shows the address and resends with a cooldown', async () => {
    history.replaceState(null, '', '/check-inbox?email=a%40example.com')
    vi.mocked(auth.resend).mockResolvedValue({ detail: 'sent' })
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<CheckInbox />)
    expect(screen.getByText('a@example.com')).toBeInTheDocument()
    const resend = screen.getByRole('button', { name: 'Resend email' })
    await userEvent.click(resend)
    expect(auth.resend).toHaveBeenCalledWith('a@example.com')
    expect(await screen.findByRole('status')).toHaveTextContent(/sent a new link/i)
    expect(screen.getByRole('button', { name: /resend in \d+s/i })).toBeDisabled()
    await act(() => vi.advanceTimersByTimeAsync(31_000))
    expect(screen.getByRole('button', { name: 'Resend email' })).toBeEnabled()
  })
})

describe('forgot password', () => {
  test('always shows the same confirmation', async () => {
    vi.mocked(auth.forgot).mockResolvedValue({ detail: 'If an account exists, we sent a link.' })
    render(<ForgotPassword />)
    await userEvent.type(screen.getByLabelText('Email'), 'a@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(auth.forgot).toHaveBeenCalledWith('a@example.com')
    expect(await screen.findByRole('status')).toHaveTextContent('If an account exists')
  })
})

describe('reset password (T-219)', () => {
  beforeEach(() => history.replaceState(null, '', '/reset-password#token=tok-123456789'))

  test('validates length and match before calling the server', async () => {
    render(<ResetPassword onSignedIn={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('New password'), 'short')
    await userEvent.type(screen.getByLabelText('Repeat new password'), 'other')
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }))
    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument()
    expect(screen.getByText("Passwords don't match.")).toBeInTheDocument()
    expect(auth.reset).not.toHaveBeenCalled()
  })

  test('sends the token from the link and signs in', async () => {
    vi.mocked(auth.reset).mockResolvedValue(user)
    const onSignedIn = vi.fn()
    render(<ResetPassword onSignedIn={onSignedIn} />)
    await userEvent.type(screen.getByLabelText('New password'), 'brand-new-pass')
    await userEvent.type(screen.getByLabelText('Repeat new password'), 'brand-new-pass')
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }))
    expect(auth.reset).toHaveBeenCalledWith('tok-123456789', 'brand-new-pass')
    expect(onSignedIn).toHaveBeenCalledWith(user)
  })

  test('explains an expired link', async () => {
    vi.mocked(auth.reset).mockRejectedValue(new ApiError(400, 'This link is invalid or has expired.'))
    render(<ResetPassword onSignedIn={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('New password'), 'brand-new-pass')
    await userEvent.type(screen.getByLabelText('Repeat new password'), 'brand-new-pass')
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('expired')
    expect(screen.getByRole('link', { name: 'Request a new link' })).toBeInTheDocument()
  })
})

describe('verify email', () => {
  test('verifies the token from the link once and signs in', async () => {
    history.replaceState(null, '', '/verify#token=tok-abcdefghij')
    vi.mocked(auth.verify).mockResolvedValue(user)
    const onSignedIn = vi.fn()
    render(<VerifyEmail onSignedIn={onSignedIn} />)
    // A just-verified account opens its demo board.
    await vi.waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(user, '/?open=first'))
    expect(auth.verify).toHaveBeenCalledTimes(1)
    expect(auth.verify).toHaveBeenCalledWith('tok-abcdefghij')
  })

  test('explains an invalid link', async () => {
    history.replaceState(null, '', '/verify#token=bad-token-123')
    vi.mocked(auth.verify).mockRejectedValue(new ApiError(400, 'This link is invalid or has expired.'))
    render(<VerifyEmail onSignedIn={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('expired')
  })
})
