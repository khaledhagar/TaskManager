import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { auth, type User } from '../api/auth'
import { ApiError } from '../api/client'
import { AuthScreen } from './AuthScreen'

vi.mock('../api/auth', async (original) => {
  const actual = await original<typeof import('../api/auth')>()
  return {
    ...actual,
    auth: {
      config: vi.fn(),
      signIn: vi.fn(),
      signUp: vi.fn(),
      guest: vi.fn(),
    },
  }
})

const user: User = {
  id: 1,
  email: 'a@example.com',
  is_guest: false,
  email_verified: true,
  has_password: true,
  google_linked: false,
  language: 'en',
}

function go(path: string) {
  history.replaceState(null, '', path)
}

beforeEach(() => {
  vi.mocked(auth.config).mockResolvedValue({ google: true })
  go('/signin')
})

describe('auth screen (T-202, T-217)', () => {
  test('shows Google, email sign in, guest, forgot password and sign up', async () => {
    render(<AuthScreen onSignedIn={vi.fn()} />)
    const google = await screen.findByRole('link', { name: 'Continue with Google' })
    expect(google).toHaveAttribute('href', '/api/auth/google/login')
    expect(screen.getByRole('heading', { name: 'Sign in to Task Manager' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue as guest' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
    expect(screen.getByRole('link', { name: 'Create an account' })).toBeInTheDocument()
  })

  test('hides the Google button when Google is not configured', async () => {
    vi.mocked(auth.config).mockResolvedValue({ google: false })
    render(<AuthScreen onSignedIn={vi.fn()} />)
    await waitFor(() => expect(auth.config).toHaveBeenCalled())
    expect(screen.queryByRole('link', { name: 'Continue with Google' })).not.toBeInTheDocument()
  })

  test('validates email and password before calling the server', async () => {
    render(<AuthScreen onSignedIn={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email')
    await userEvent.type(screen.getByLabelText('Password'), 'short')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(auth.signIn).not.toHaveBeenCalled()
  })

  test('signs in and reports the user', async () => {
    vi.mocked(auth.signIn).mockResolvedValue(user)
    const onSignedIn = vi.fn()
    render(<AuthScreen onSignedIn={onSignedIn} />)
    await userEvent.type(screen.getByLabelText('Email'), 'a@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'correct-horse')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(auth.signIn).toHaveBeenCalledWith({ email: 'a@example.com', password: 'correct-horse' })
    expect(onSignedIn).toHaveBeenCalledWith(user)
  })

  test('shows the server error', async () => {
    vi.mocked(auth.signIn).mockRejectedValue(new ApiError(401, 'Invalid email or password'))
    render(<AuthScreen onSignedIn={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('Email'), 'a@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
  })

  test('unverified sign in offers a new verification link', async () => {
    vi.mocked(auth.signIn).mockRejectedValue(new ApiError(403, 'Please verify your email first.'))
    render(<AuthScreen onSignedIn={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('Email'), 'a@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'correct-horse')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Send a new link' }))
    expect(location.pathname + location.search).toBe('/check-inbox?email=a%40example.com')
  })

  test('switches to sign up and sends new users to check their inbox', async () => {
    vi.mocked(auth.signUp).mockResolvedValue({ email: 'b@example.com', verification_required: true })
    render(<AuthScreen onSignedIn={vi.fn()} />)
    await userEvent.click(screen.getByRole('link', { name: 'Create an account' }))
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Forgot password?' })).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Email'), 'b@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'Correct-Horse-42')
    await userEvent.type(screen.getByLabelText('Repeat password'), 'Correct-Horse-4')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    // T-768: sign-up asks for the password twice; a mismatch sends nothing.
    expect(screen.getByText("Passwords don't match.")).toBeInTheDocument()
    expect(auth.signUp).not.toHaveBeenCalled()
    await userEvent.type(screen.getByLabelText('Repeat password'), '2')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(auth.signUp).toHaveBeenCalledWith({ email: 'b@example.com', password: 'Correct-Horse-42' })
    expect(location.pathname + location.search).toBe('/check-inbox?email=b%40example.com')
  })

  test('sign up shows the strength meter and refuses a weak password without a request (T-507)', async () => {
    render(<AuthScreen onSignedIn={vi.fn()} />)
    await userEvent.click(screen.getByRole('link', { name: 'Create an account' }))
    await userEvent.type(screen.getByLabelText('Email'), 'b@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'abcdefghij')
    expect(screen.getByRole('status')).toHaveTextContent('Password strength: Weak')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true')
    expect(auth.signUp).not.toHaveBeenCalled()
  })

  test('sign in has no strength meter and accepts any 8-character password', async () => {
    vi.mocked(auth.signIn).mockResolvedValue(user)
    render(<AuthScreen onSignedIn={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('Email'), 'a@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'abcdefgh')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(auth.signIn).toHaveBeenCalled()
  })

  test('continue as guest signs in without a form', async () => {
    vi.mocked(auth.guest).mockResolvedValue({ ...user, email: null, is_guest: true })
    const onSignedIn = vi.fn()
    render(<AuthScreen onSignedIn={onSignedIn} />)
    await userEvent.click(screen.getByRole('button', { name: 'Continue as guest' }))
    // T-801: a new guest also starts on the start page.
    expect(onSignedIn).toHaveBeenCalledWith(expect.objectContaining({ is_guest: true }))
  })

  test('explains a failed Google sign-in', async () => {
    go('/signin?error=google')
    render(<AuthScreen onSignedIn={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/google sign-in didn't complete/i)
  })
})
