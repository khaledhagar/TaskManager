import { describe, expect, test } from 'vitest'
import type { Board, BoardSummary, Card } from '../api/boards'
import { parseCommand, type Context } from './commands'

const card = (id: number, title: string): Card => ({
  id,
  title,
  details: '',
  completed: false,
  priority: 'medium',
  due_date: null,
  position: 0,
  label_ids: [],
  checklist: [],
  attachments: [],
  assignee_ids: [],
})

const board = (columns: [number, string, Card[]][]): Board => ({
  id: 1,
  title: 'Launch',
  background: { kind: 'none', preset: null, version: 0 },
  role: 'admin',
  public: false,
  public_link: null,
  meeting_url: null,
  members: [
    { user_id: 1, email: 'ann@example.com' },
    { user_id: 2, email: 'sara@example.com' },
  ],
  labels: [{ id: 9, name: 'Bug', color: 'red' }],
  columns: columns.map(([id, title, cards], position) => ({ id, title, position, cards })),
})

const BOARDS: BoardSummary[] = [
  { id: 1, title: 'Launch', created_at: '', role: 'admin' },
  { id: 2, title: 'Marketing', created_at: '', role: 'admin' },
  { id: 3, title: 'التسويق', created_at: '', role: 'admin' },
]
// Thursday 22 October 2026.
const TODAY = new Date(2026, 9, 22)

const EN: Context = {
  board: board([
    [10, 'To Do', [card(1, 'Buy domain'), card(2, 'Design page'), card(3, 'Design logo')]],
    [11, 'In Progress', [card(4, 'Write post')]],
    [12, 'Done', []],
  ]),
  boards: BOARDS,
  me: 1,
  today: TODAY,
}
const AR: Context = {
  ...EN,
  board: board([
    [20, 'المطلوب', [card(5, 'شراء النطاق'), card(6, 'مراجعة التصميم')]],
    [21, 'قيد التنفيذ', []],
    [22, 'تم', []],
  ]),
}

const change = (text: string, ctx = EN) => {
  const result = parseCommand(text, ctx)
  if (result.kind !== 'change') throw new Error(`${text}: ${JSON.stringify(result)}`)
  return result.change
}
const lookup = (text: string, ctx = EN) => {
  const result = parseCommand(text, ctx)
  if (result.kind !== 'lookup') throw new Error(`${text}: ${JSON.stringify(result)}`)
  return result.lookup
}

describe('English commands (T-780)', () => {
  test('add a card, with or without a column; " to " inside a title is kept', () => {
    expect(change('add card Buy hosting to In Progress')).toEqual({ type: 'add', title: 'Buy hosting', columnId: 11 })
    expect(change('Add card Buy hosting.')).toEqual({ type: 'add', title: 'Buy hosting', columnId: 10 })
    expect(change('add a task Call the bank to the done column')).toEqual({ type: 'add', title: 'Call the bank', columnId: 12 })
    expect(change('add card Talk to Sara')).toEqual({ type: 'add', title: 'Talk to Sara', columnId: 10 })
  })

  test('move, complete, reopen, delete, rename', () => {
    expect(change('move buy domain to done')).toEqual({ type: 'move', cardId: 1, columnId: 12 })
    expect(change('complete write post')).toEqual({ type: 'complete', cardId: 4, done: true })
    expect(change('mark write post as done')).toEqual({ type: 'complete', cardId: 4, done: true })
    expect(change('reopen write post')).toEqual({ type: 'complete', cardId: 4, done: false })
    expect(change('delete buy domain')).toEqual({ type: 'delete', cardId: 1 })
    expect(change('rename buy domain to Buy the domain')).toEqual({ type: 'rename', cardId: 1, title: 'Buy the domain' })
  })

  test('priority, assign, add column', () => {
    expect(change('set buy domain priority to urgent')).toEqual({ type: 'priority', cardId: 1, priority: 'urgent' })
    expect(change('make buy domain high priority')).toEqual({ type: 'priority', cardId: 1, priority: 'high' })
    expect(change('assign buy domain to me')).toEqual({ type: 'assign', cardId: 1, userId: 1 })
    expect(change('assign buy domain to sara')).toEqual({ type: 'assign', cardId: 1, userId: 2 })
    expect(change('add column Review')).toEqual({ type: 'addColumn', title: 'Review' })
  })

  test('look-ups happen at once', () => {
    expect(lookup('open write post')).toEqual({ type: 'openCard', cardId: 4 })
    expect(lookup('open board marketing')).toEqual({ type: 'openBoard', boardId: 2 })
    expect(lookup('all boards')).toEqual({ type: 'home' })
    expect(lookup('search domain')).toEqual({ type: 'search', text: 'domain' })
    expect(lookup('show my cards')).toEqual({ type: 'filter', filters: { assignee: 1, status: 'all' } })
    expect(lookup('show overdue')).toEqual({ type: 'filter', filters: { status: 'overdue', assignee: null } })
    expect(lookup('show urgent cards')).toEqual({ type: 'filter', filters: { priority: 'urgent' } })
    expect(lookup('show completed')).toEqual({ type: 'filter', filters: { status: 'done', assignee: null } })
    expect(lookup('clear filters')).toEqual({ type: 'clearFilters' })
    expect(lookup('what can I say?')).toEqual({ type: 'help' })
  })

  test('not understood', () => {
    expect(parseCommand('hello there', EN)).toEqual({ kind: 'unknown' })
  })
})

describe('Arabic commands (T-781)', () => {
  test('changes', () => {
    expect(change('أضف بطاقة كتابة المقالة إلى قيد التنفيذ', AR)).toEqual({ type: 'add', title: 'كتابة المقالة', columnId: 21 })
    expect(change('اضف مهمة الاتصال بالبنك', AR)).toEqual({ type: 'add', title: 'الاتصال بالبنك', columnId: 20 })
    expect(change('انقل شراء النطاق إلى تم', AR)).toEqual({ type: 'move', cardId: 5, columnId: 22 })
    expect(change('أنجز شراء النطاق', AR)).toEqual({ type: 'complete', cardId: 5, done: true })
    expect(change('أعد فتح شراء النطاق', AR)).toEqual({ type: 'complete', cardId: 5, done: false })
    expect(change('احذف مراجعه التصميم', AR)).toEqual({ type: 'delete', cardId: 6 })
    expect(change('غيّر اسم شراء النطاق إلى شراء الدومين', AR)).toEqual({ type: 'rename', cardId: 5, title: 'شراء الدومين' })
    expect(change('اجعل أولوية شراء النطاق عاجلة', AR)).toEqual({ type: 'priority', cardId: 5, priority: 'urgent' })
    expect(change('موعد شراء النطاق غدا', AR)).toEqual({ type: 'due', cardId: 5, date: '2026-10-23' })
    expect(change('أسند شراء النطاق إليّ', AR)).toEqual({ type: 'assign', cardId: 5, userId: 1 })
    expect(change('أضف عمود المراجعة', AR)).toEqual({ type: 'addColumn', title: 'المراجعة' })
  })

  test('look-ups', () => {
    expect(lookup('ابحث عن النطاق', AR)).toEqual({ type: 'search', text: 'النطاق' })
    expect(lookup('اعرض المتأخرة', AR)).toEqual({ type: 'filter', filters: { status: 'overdue', assignee: null } })
    expect(lookup('اعرض بطاقاتي', AR)).toEqual({ type: 'filter', filters: { assignee: 1, status: 'all' } })
    expect(lookup('امسح الفلاتر', AR)).toEqual({ type: 'clearFilters' })
    expect(lookup('ماذا يمكنني أن أقول؟', AR)).toEqual({ type: 'help' })
    expect(lookup('كل اللوحات', AR)).toEqual({ type: 'home' })
    expect(lookup('افتح لوحة التسويق', AR)).toEqual({ type: 'openBoard', boardId: 3 })
    expect(lookup('افتح شراء النطاق', AR)).toEqual({ type: 'openCard', cardId: 5 })
  })
})

describe('name matching (T-782)', () => {
  test('case, punctuation and a small slip do not matter', () => {
    expect(change('Move "Buy Domain" to DONE.')).toEqual({ type: 'move', cardId: 1, columnId: 12 })
    expect(change('move buy domian to done')).toEqual({ type: 'move', cardId: 1, columnId: 12 })
  })

  test('several close names are offered to choose from', () => {
    const result = parseCommand('move design to done', EN)
    expect(result.kind).toBe('choose')
    if (result.kind !== 'choose') return
    expect(result.options.map((o) => o.label)).toEqual(['Design page', 'Design logo'])
    expect(result.options[1].result).toEqual({ kind: 'change', change: { type: 'move', cardId: 3, columnId: 12 } })
  })

  test('no match says what was not found', () => {
    expect(parseCommand('move unicorn to done', EN)).toEqual({ kind: 'notFound', what: 'card', name: 'unicorn' })
    expect(parseCommand('open board zebra', EN)).toEqual({ kind: 'notFound', what: 'board', name: 'zebra' })
  })

  test('board commands need a board; on the start page only board look-ups work', () => {
    const start = { ...EN, board: null }
    expect(parseCommand('open board marketing', start)).toEqual({ kind: 'lookup', lookup: { type: 'openBoard', boardId: 2 } })
    expect(parseCommand('move buy domain to done', start)).toEqual({ kind: 'needBoard' })
  })
})

describe('due dates and priorities (T-783)', () => {
  test('today, tomorrow, next week and weekdays', () => {
    expect(change('buy domain due today')).toEqual({ type: 'due', cardId: 1, date: '2026-10-22' })
    expect(change('set buy domain due next week')).toEqual({ type: 'due', cardId: 1, date: '2026-10-29' })
    expect(change('buy domain due monday')).toEqual({ type: 'due', cardId: 1, date: '2026-10-26' })
    expect(change('buy domain due thursday')).toEqual({ type: 'due', cardId: 1, date: '2026-10-29' })
    expect(change('موعد شراء النطاق السبت', AR)).toEqual({ type: 'due', cardId: 5, date: '2026-10-24' })
  })

  test('each priority word', () => {
    for (const [word, priority] of [['low', 'low'], ['normal', 'medium'], ['high', 'high'], ['urgent', 'urgent']]) {
      expect(change(`set buy domain priority to ${word}`)).toEqual({ type: 'priority', cardId: 1, priority })
    }
    expect(change('اجعل أولوية شراء النطاق منخفضة', AR)).toEqual({ type: 'priority', cardId: 5, priority: 'low' })
  })
})
