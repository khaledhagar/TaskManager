import { afterEach, describe, expect, test } from 'vitest'
import type { ActivityEntry } from '../api/collab'
import { applyLanguage } from '../i18n/language'
import { activityText, timeAgo } from './activityText'

const entry = (kind: string, data: ActivityEntry['data'], actor: string | null = 'bob@example.com'): ActivityEntry => ({
  id: 1,
  kind,
  data,
  card_id: null,
  actor_email: actor,
  created_at: '2026-10-21T10:00:00Z',
})

afterEach(() => applyLanguage('en'))

describe('activity sentences (T-650)', () => {
  test('other members by email, the user as You, a deleted account as Someone', () => {
    expect(activityText(entry('card.moved', { title: 'Fix', column: 'Done' }), 'alice@example.com')).toBe('bob@example.com moved "Fix" to Done')
    expect(activityText(entry('card.completed', { title: 'Fix' }, 'alice@example.com'), 'alice@example.com')).toBe('You completed "Fix"')
    expect(activityText(entry('comment.added', { title: 'Fix' }, null), 'alice@example.com')).toBe('Someone commented on "Fix"')
  })

  test('roles are translated and unknown kinds still read well', () => {
    expect(activityText(entry('member.role', { email: 'carol@example.com', role: 'updater' }), null)).toBe(
      'bob@example.com changed the permission of carol@example.com to Can update tasks',
    )
    expect(activityText(entry('something.new', {}), null)).toBe('bob@example.com changed the board')
  })

  test('Arabic sentences', () => {
    applyLanguage('ar')
    expect(activityText(entry('card.completed', { title: 'Fix' }, 'me@example.com'), 'me@example.com')).toBe('أكمل أنت "Fix"')
  })

  test('relative time', () => {
    const now = Date.parse('2026-10-21T12:00:00Z')
    expect(timeAgo('2026-10-21T11:55:00Z', now)).toBe('5 minutes ago')
    expect(timeAgo('2026-10-20T12:00:00Z', now)).toBe('yesterday')
    expect(timeAgo('2026-10-21T12:00:00Z', now)).toBe('this minute')
  })
})
