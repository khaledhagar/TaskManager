import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { sharing, type Members } from '../api/sharing'
import { MembersPanel } from './MembersPanel'

vi.mock('../api/sharing', async (original) => ({
  ...(await original<typeof import('../api/sharing')>()),
  sharing: {
    members: vi.fn(),
    changeRole: vi.fn(),
    remove: vi.fn(),
    invite: vi.fn(),
    resend: vi.fn(),
    cancel: vi.fn(),
    approve: vi.fn(),
    decline: vi.fn(),
    requestAccess: vi.fn(),
    setVisibility: vi.fn(),
    setMeeting: vi.fn(),
    emailMeeting: vi.fn(),
  },
}))

const adminView: Members = {
  role: 'admin',
  members: [
    { user_id: 1, email: 'alice@example.com', role: 'admin' },
    { user_id: 2, email: 'bob@example.com', role: 'viewer' },
  ],
  invites: [{ id: 7, email: 'carol@example.com', expires_at: '2026-10-28T00:00:00Z' }],
  requests: [{ id: 9, user_id: 2, email: 'bob@example.com', role: 'viewer', created_at: '' }],
  requested: false,
}

const LINK = 'http://app.test/invite#token=abc'

function open(props: Partial<Parameters<typeof MembersPanel>[0]> = {}) {
  render(
    <MembersPanel
      open
      onClose={vi.fn()}
      board={{ id: 5, title: 'Launch', public: false, public_link: null, meeting_url: null }}
      userId={1}
      isGuest={false}
      onLeft={vi.fn()}
      onBoardChange={vi.fn()}
      {...props}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(sharing.members).mockResolvedValue(adminView)
})

describe('members panel for the admin (T-540 to T-543)', () => {
  test('each member has one permission; choosing another saves it', async () => {
    open()
    const group = await screen.findByRole('group', { name: 'Permission for bob@example.com' })
    expect(within(group).getByRole('radio', { name: 'Viewer' })).toBeChecked()
    expect(within(group).getAllByRole('radio').filter((r) => (r as HTMLInputElement).checked)).toHaveLength(1)
    await userEvent.click(within(group).getByRole('radio', { name: 'Full access' }))
    expect(sharing.changeRole).toHaveBeenCalledWith(5, 2, 'editor')
    expect(sharing.members).toHaveBeenCalledTimes(2)
  })

  test('the admin row is fixed and Remove asks first', async () => {
    open()
    await screen.findByText('alice@example.com')
    expect(screen.queryByRole('group', { name: 'Permission for alice@example.com' })).toBeNull()
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove alice@example.com' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Remove bob@example.com' }))
    expect(sharing.remove).not.toHaveBeenCalled()
    expect(screen.getByText('Remove bob@example.com from this board?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(sharing.remove).toHaveBeenCalledWith(5, 2)
  })

  test('access requests can be allowed or declined', async () => {
    open()
    await userEvent.click(await screen.findByRole('button', { name: 'Allow: Can update tasks' }))
    expect(sharing.approve).toHaveBeenCalledWith(9, 'updater')
    await userEvent.click(screen.getByRole('button', { name: 'Decline' }))
    expect(sharing.decline).toHaveBeenCalledWith(9)
  })

  test('invite validates the email, then shows the link with Copy and WhatsApp', async () => {
    vi.mocked(sharing.invite).mockResolvedValue({ id: 8, email: 'dan@example.com', expires_at: '', link: LINK })
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    open()
    await screen.findByText('carol@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Invite' }))
    expect(screen.getByText('Enter your email address.')).toBeInTheDocument()
    expect(sharing.invite).not.toHaveBeenCalled()
    await userEvent.type(screen.getByLabelText('Invite by email'), 'dan@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Invite' }))
    expect(sharing.invite).toHaveBeenCalledWith(5, 'dan@example.com')
    expect(await screen.findByDisplayValue(LINK)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(writeText).toHaveBeenCalledWith(LINK)
    expect(screen.getByRole('button', { name: 'Link copied' })).toBeInTheDocument()
    const whatsapp = screen.getByRole('link', { name: 'Share on WhatsApp' })
    expect(whatsapp.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\?text=/)
    expect(decodeURIComponent(whatsapp.getAttribute('href')!)).toContain(LINK)
    expect(whatsapp).toHaveAttribute('rel', 'noopener noreferrer')
  })

  test('pending invites can be sent again (new link) or cancelled', async () => {
    vi.mocked(sharing.resend).mockResolvedValue({ id: 7, email: 'carol@example.com', expires_at: '', link: LINK })
    open()
    await userEvent.click(await screen.findByRole('button', { name: 'Send the invitation to carol@example.com again' }))
    expect(sharing.resend).toHaveBeenCalledWith(7)
    expect(await screen.findByText(/The old link no longer works/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel the invitation to carol@example.com' }))
    expect(sharing.cancel).toHaveBeenCalledWith(7)
  })

  test('a guest admin is asked to create an account (T-551)', async () => {
    open({ isGuest: true })
    expect(await screen.findByText('Create an account to share this board.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Invite by email')).toBeNull()
  })
})

describe('public link and meeting link (T-571, T-575, T-576)', () => {
  test('switching to public shows the link to copy or share; switching back hides it', async () => {
    const onBoardChange = vi.fn()
    vi.mocked(sharing.setVisibility).mockResolvedValue({ public: true, link: 'http://app.test/p/xyz' })
    open({ onBoardChange })
    expect(await screen.findByText('Private: only members can see this board.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Anyone with the link can view' }))
    expect(sharing.setVisibility).toHaveBeenCalledWith(5, true)
    expect(onBoardChange).toHaveBeenCalledWith({ public: true, public_link: 'http://app.test/p/xyz' })
  })

  test('a public board shows its link', async () => {
    open({ board: { id: 5, title: 'Launch', public: true, public_link: 'http://app.test/p/xyz', meeting_url: null } })
    expect(await screen.findByDisplayValue('http://app.test/p/xyz')).toBeInTheDocument()
    const share = screen.getAllByRole('link', { name: 'Share on WhatsApp' })[0]
    expect(decodeURIComponent(share.getAttribute('href')!)).toContain('See my board "Launch"')
  })

  test('the meeting link must be https; saved links can be emailed and removed', async () => {
    const onBoardChange = vi.fn()
    const url = 'https://zoom.us/j/123'
    vi.mocked(sharing.setMeeting).mockResolvedValue({ url })
    vi.mocked(sharing.emailMeeting).mockResolvedValue({ sent: 1 })
    open({ onBoardChange })
    const field = await screen.findByLabelText('Meeting link (Zoom, Google Meet, Teams)')
    await userEvent.type(field, 'javascript:alert(1)')
    await userEvent.click(screen.getByRole('button', { name: 'Save link' }))
    expect(screen.getByText('Use an https link, for example https://zoom.us/j/123.')).toBeInTheDocument()
    expect(sharing.setMeeting).not.toHaveBeenCalled()
    await userEvent.clear(field)
    await userEvent.type(field, url)
    await userEvent.click(screen.getByRole('button', { name: 'Save link' }))
    expect(sharing.setMeeting).toHaveBeenCalledWith(5, url)
    expect(onBoardChange).toHaveBeenCalledWith({ meeting_url: url })
  })

  test('with a meeting link: Start meeting opens safely, Email sends it to members', async () => {
    vi.mocked(sharing.emailMeeting).mockResolvedValue({ sent: 1 })
    open({ board: { id: 5, title: 'Launch', public: false, public_link: null, meeting_url: 'https://zoom.us/j/1' } })
    const start = await screen.findByRole('link', { name: 'Start meeting' })
    expect(start).toHaveAttribute('href', 'https://zoom.us/j/1')
    expect(start).toHaveAttribute('rel', 'noopener noreferrer')
    expect(start).toHaveAttribute('target', '_blank')
    await userEvent.click(screen.getByRole('button', { name: 'Email the link to members' }))
    expect(sharing.emailMeeting).toHaveBeenCalledWith(5)
    expect(await screen.findByText('The meeting link was emailed to the members.')).toBeInTheDocument()
  })
})

describe('members panel for a member (T-548, T-549)', () => {
  const memberView: Members = { ...adminView, role: 'viewer', invites: [], requests: [] }

  test('read-only list, Request access once, Leave board', async () => {
    vi.mocked(sharing.members).mockResolvedValueOnce(memberView).mockResolvedValue({ ...memberView, requested: true })
    vi.mocked(sharing.remove).mockResolvedValue(undefined)
    const onLeft = vi.fn()
    open({ userId: 2, onLeft })
    expect(await screen.findByText('Your permission: Viewer')).toBeInTheDocument()
    expect(screen.queryByRole('radio')).toBeNull()
    expect(screen.queryByLabelText('Invite by email')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Request access' }))
    expect(sharing.requestAccess).toHaveBeenCalledWith(5)
    expect(await screen.findByRole('button', { name: 'Request sent' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Leave board' }))
    await userEvent.click(screen.getAllByRole('button', { name: 'Leave board' })[0])
    expect(sharing.remove).toHaveBeenCalledWith(5, 2)
    await vi.waitFor(() => expect(onLeft).toHaveBeenCalled())
  })
})
