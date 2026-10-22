import { describe, expect, test } from 'vitest'
import type { Notice } from '../api/notifications'
import { noticeLink, noticeText } from './notices'

const meeting: Notice = {
  id: 1, kind: 'meeting', board_id: 4, card_id: null, actor_email: 'alice@example.com',
  data: { board: 'Team plan' }, created_at: '', read: false,
}

describe('meeting notification (T-803)', () => {
  test('names who sent it and the board, and opens the board', () => {
    expect(noticeText(meeting)).toBe('alice@example.com invites you to a meeting for "Team plan"')
    expect(noticeLink(meeting)).toBe('/?board=4')
  })
})
