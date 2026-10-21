import type { Board, BoardSummary, Card, Column, Priority, Role } from '../api/boards'
import type { Filters } from '../board/logic'
import { clean, findMatches, fold, key } from './text'
import { DUE_WORDS, dueFrom, PRIORITY_WORDS, priorityFrom } from './when'

export type Change =
  | { type: 'add'; title: string; columnId: number }
  | { type: 'move'; cardId: number; columnId: number }
  | { type: 'complete'; cardId: number; done: boolean }
  | { type: 'delete'; cardId: number }
  | { type: 'rename'; cardId: number; title: string }
  | { type: 'priority'; cardId: number; priority: Priority }
  | { type: 'due'; cardId: number; date: string }
  | { type: 'assign'; cardId: number; userId: number }
  | { type: 'addColumn'; title: string }
export type Lookup =
  | { type: 'openCard'; cardId: number }
  | { type: 'openBoard'; boardId: number }
  | { type: 'home' }
  | { type: 'search'; text: string }
  | { type: 'filter'; filters: Partial<Filters> }
  | { type: 'clearFilters' }
  | { type: 'help' }
export type Parsed =
  | { kind: 'change'; change: Change }
  | { kind: 'lookup'; lookup: Lookup }
  | { kind: 'choose'; options: { label: string; result: Parsed }[] }
  | { kind: 'notFound'; what: 'card' | 'column' | 'board' | 'member'; name: string }
  | { kind: 'needBoard' }
  | { kind: 'unknown' }
export type Context = { board: Board | null; boards: BoardSummary[]; me: number; today: Date }

/** The board role a change needs, the same as its button (SEC-218). */
export const NEED: Record<Change['type'], Role> = {
  add: 'editor', move: 'updater', complete: 'updater', delete: 'editor', rename: 'editor',
  priority: 'editor', due: 'editor', assign: 'editor', addColumn: 'editor',
}

type Said = { orig: string; low: string }
type Rule = (s: Said, ctx: Context & { board: Board }) => Parsed | null

const change = (c: Change): Parsed => ({ kind: 'change', change: c })
const lookup = (l: Lookup): Parsed => ({ kind: 'lookup', lookup: l })
const words = (list: string[]) => list.join('|')

/** The groups of `re` (made with the d flag) cut from the original words, keeping their spelling. */
function groups(s: Said, re: RegExp): string[] | null {
  const m = re.exec(s.low)
  return m ? m.indices!.slice(1).map((r) => (r ? s.orig.slice(r[0], r[1]) : '')) : null
}

/** Every way to cut `text` at one of the separator words, as [before, after]. */
function splits(text: string, seps: string[]): [string, string][] {
  const re = new RegExp(` (?:${words(seps)}) `, 'g')
  return [...fold(text).matchAll(re)].map((m) => [text.slice(0, m.index), text.slice(m.index + m[0].length)])
}

/** A name said for a column, without "the ... column" around it. */
function columnName(text: string): string {
  const low = fold(text)
  const start = /^(?:the |عمود )/.exec(low)?.[0].length ?? 0
  const end = / (?:column|list)$/.exec(low)?.index ?? low.length
  return text.slice(start, end)
}

/** 2: exactly one of the names; 1: close to one; 0: none. */
function fit<T>(said: string, items: T[], names: (item: T) => string[]): number {
  const found = findMatches(said, items, names)
  if (!found.length) return 0
  return names(found[0]).some((n) => key(n) === key(said)) ? 2 : 1
}

/** The split whose `side` fits best (0 = before, 1 = after); null when none fits. */
function bestSplit<T>(parts: [string, string][], side: 0 | 1, items: T[], names: (item: T) => string[]) {
  const ranked = parts.map((p) => ({ p, r: fit(side ? columnName(p[1]) : p[0], items, names) }))
  const best = Math.max(0, ...ranked.map((x) => x.r))
  return best ? ranked.find((x) => x.r === best)!.p : null
}

function oneOf<T>(
  name: string, items: T[], names: (item: T) => string[], what: 'card' | 'column' | 'board' | 'member',
  label: (item: T) => string, build: (item: T) => Parsed,
): Parsed {
  const found = findMatches(name, items, names)
  if (!found.length) return { kind: 'notFound', what, name: clean(name) }
  if (found.length === 1) return build(found[0])
  return { kind: 'choose', options: found.map((item) => ({ label: label(item), result: build(item) })) }
}

const cards = (b: Board) => b.columns.flatMap((c) => c.cards)
const withCard = (b: Board, name: string, build: (c: Card) => Parsed) =>
  oneOf(name, cards(b), (c) => [c.title], 'card', (c) => c.title, build)
const withColumn = (b: Board, name: string, build: (c: Column) => Parsed) =>
  oneOf(columnName(name), b.columns, (c) => [c.title], 'column', (c) => c.title, build)

const ME = ['me', 'myself', 'نفسي', 'لنفسي', 'لي', 'الي']
const memberNames = (m: Board['members'][number]) => [m.email ?? '', (m.email ?? '').split('@')[0]]
const DAYS = words(DUE_WORDS)
const LEVELS = words(PRIORITY_WORDS)

/** "show ...": the filter it names, or null for anything else ("show Buy domain" opens it). */
function filterFor(rest: string, ctx: Context & { board: Board }): Parsed | null {
  const r = key(rest).replace(/ (?:cards|tasks|priority)$/, '')
  if (['my', 'mine', 'assigned to me', 'بطاقاتي', 'مهامي'].includes(r))
    return lookup({ type: 'filter', filters: { assignee: ctx.me, status: 'all' } })
  if (['overdue', 'late', 'المتاخره', 'المتاخر'].includes(r)) return lookup({ type: 'filter', filters: { status: 'overdue', assignee: null } })
  if (['completed', 'done', 'finished', 'المنجزه', 'المكتمله'].includes(r)) return lookup({ type: 'filter', filters: { status: 'done', assignee: null } })
  if (['open', 'المفتوحه'].includes(r)) return lookup({ type: 'filter', filters: { status: 'open', assignee: null } })
  if (['all', 'everything', 'الكل', 'كل البطاقات'].includes(r)) return lookup({ type: 'clearFilters' })
  const priority = priorityFrom(r) ?? priorityFrom(r.replace(/^ال/, ''))
  if (priority) return lookup({ type: 'filter', filters: { priority } })
  const label = ctx.board.labels.find((l) => key(l.name) === r.replace(/^label /, ''))
  return label ? lookup({ type: 'filter', filters: { labelId: label.id } }) : null
}

/** Commands for the open board, in order: the first that fits wins. */
const BOARD_RULES: Rule[] = [
  (s) => (groups(s, /^(?:clear|reset|remove|امسح|الغ|ازل) (?:all )?(?:the )?(?:filters?|search|الفلاتر|الفلتر|البحث|التصفيه)$/d) ? lookup({ type: 'clearFilters' }) : null),
  (s, ctx) => {
    const g = groups(s, /^(?:show|filter|اعرض|اظهر)(?: me)? (.+)$/d)
    return g ? filterFor(g[0], ctx) : null
  },
  (s) => {
    const g = groups(s, /^(?:search(?: for)?|find|look for|ابحث عن|ابحث|بحث عن) (.+)$/d)
    return g ? lookup({ type: 'search', text: g[0] }) : null
  },
  (s) => {
    const g = groups(s, /^(?:add|create|new|اضف|انشئ|اضيفي) (?:a )?(?:new )?(?:column|list|عمودا|عمود)(?: called| named)? (.+)$/d)
    return g ? change({ type: 'addColumn', title: g[0] }) : null
  },
  (s, { board }) => {
    const g = groups(s, /^(?:add|create|new|اضف|انشئ|اضيفي|ضيف) (?:a )?(?:new )?(?:card|task|بطاقه|مهمه)(?: جديده)?(?: called| named)? (.+)$/d)
    if (!g) return null
    if (!board.columns.length) return { kind: 'notFound', what: 'column', name: '' }
    const split = bestSplit(splits(g[0], ['to', 'in', 'into', 'on', 'الي', 'في', 'علي']), 1, board.columns, (c) => [c.title])
    if (!split) return change({ type: 'add', title: g[0], columnId: board.columns[0].id })
    return withColumn(board, split[1], (col) => change({ type: 'add', title: split[0], columnId: col.id }))
  },
  (s, { board }) => {
    const g = groups(s, /^(?:move|put|drag|انقل|حرك|ضع) (.+)$/d)
    if (!g) return null
    const parts = splits(g[0], ['to', 'into', 'in', 'onto', 'الي', 'في'])
    const split = bestSplit(parts, 1, board.columns, (c) => [c.title])
    if (!split) return { kind: 'notFound', what: 'column', name: clean(parts.at(-1)?.[1] ?? '') }
    return withColumn(board, split[1], (col) => withCard(board, split[0], (c) => change({ type: 'move', cardId: c.id, columnId: col.id })))
  },
  (s, { board }) => {
    const g = groups(s, /^(?:rename|change the name of|غير اسم|اعد تسميه) (.+)$/d)
    if (!g) return null
    const split = bestSplit(splits(g[0], ['to', 'الي', 'ب']).map(([a, b]) => [b, a] as [string, string]), 1, cards(board), (c) => [c.title])
    if (!split) return { kind: 'notFound', what: 'card', name: clean(g[0]) }
    return withCard(board, split[1], (c) => change({ type: 'rename', cardId: c.id, title: split[0] }))
  },
  (s, ctx) => {
    const g = groups(s, /^(?:assign|اسند|عين) (.+)$/d)
    if (!g) return null
    const { board } = ctx
    const parts = splits(`${g[0]} `, ['to', 'الي', 'ل']).map(([a, b]) => [a, b.trim()] as [string, string])
    const toMe = parts.find(([, who]) => ME.includes(key(who)) || who === '')
    if (toMe) return withCard(board, toMe[0], (c) => change({ type: 'assign', cardId: c.id, userId: ctx.me }))
    const split = bestSplit(parts.map(([a, b]) => [a, b] as [string, string]), 1, board.members, memberNames)
    if (!split) return { kind: 'notFound', what: 'member', name: clean(parts.at(-1)?.[1] ?? '') }
    return oneOf(split[1], board.members, memberNames, 'member', (m) => m.email ?? '', (m) =>
      withCard(board, split[0], (c) => change({ type: 'assign', cardId: c.id, userId: m.user_id })))
  },
  (s, { board }) => {
    const g = groups(s, new RegExp(`^(?:set|make|change)(?: the)? (?:priority (?:of|for) )?(.+?)(?: priority)?(?: to| as)? (${LEVELS})(?: priority)?$`, 'd'))
      ?? groups(s, new RegExp(`^(?:اجعل|غير) اولويه (.+) (${LEVELS})$`, 'd'))
    return g ? withCard(board, g[0], (c) => change({ type: 'priority', cardId: c.id, priority: priorityFrom(fold(g[1])) })) : null
  },
  (s, ctx) => {
    const g = groups(s, new RegExp(`^(?:set )?(?:the )?(?:due date (?:of|for) )?(.+?)(?: is)? due(?: date)?(?: to| on| for)? (${DAYS})$`, 'd'))
      ?? groups(s, new RegExp(`^(?:اجعل )?موعد (.+) (${DAYS})$`, 'd'))
    return g ? withCard(ctx.board, g[0], (c) => change({ type: 'due', cardId: c.id, date: dueFrom(fold(g[1]), ctx.today) })) : null
  },
  (s, { board }) => {
    const g = groups(s, /^(?:reopen|uncheck|untick|اعد فتح|اعاده فتح) (.+)$/d)
      ?? groups(s, /^mark (.+?) (?:as )?(?:not done|not complete|open|incomplete|undone)$/d)
    return g ? withCard(board, g[0], (c) => change({ type: 'complete', cardId: c.id, done: false })) : null
  },
  (s, { board }) => {
    const g = groups(s, /^(?:complete|finish|check off|tick off|tick|انجز|اكمل|اتمم|انه|انهي) (.+)$/d)
      ?? groups(s, /^mark (.+?) (?:as )?(?:done|complete|completed|finished)$/d)
    return g ? withCard(board, g[0], (c) => change({ type: 'complete', cardId: c.id, done: true })) : null
  },
  (s, { board }) => {
    const g = groups(s, /^(?:delete|remove|احذف|امسح|ازل) (?:the )?(?:card |task |البطاقه |المهمه )?(.+)$/d)
    return g ? withCard(board, g[0], (c) => change({ type: 'delete', cardId: c.id })) : null
  },
  (s, { board }) => {
    const g = groups(s, /^(?:open|show|go to|افتح|اعرض) (?:the )?(?:card |task |البطاقه |المهمه )?(.+)$/d)
    return g ? withCard(board, g[0], (c) => lookup({ type: 'openCard', cardId: c.id })) : null
  },
]

/** What a spoken (or typed) command asks for, given the open board (null on the start page). */
export function parseCommand(text: string, ctx: Context): Parsed {
  const orig = clean(text)
  const s: Said = { orig, low: fold(orig) }
  if (/^(?:what can i say|help|commands|show commands|ماذا يمكنني ان اقول|ماذا اقول|مساعده|الاوامر)$/.test(s.low)) return lookup({ type: 'help' })
  if (/^(?:(?:go to|open|show) )?(?:all boards|all my boards|my boards|home|start page|كل اللوحات|جميع اللوحات|اللوحات|الصفحه الرئيسيه)$/.test(s.low))
    return lookup({ type: 'home' })
  const board = groups(s, /^(?:open|go to|show|switch to|افتح|اذهب الي) (?:the )?(?:board|لوحه|اللوحه) (.+)$/d)
  if (board) return oneOf(board[0], ctx.boards, (b) => [b.title], 'board', (b) => b.title, (b) => lookup({ type: 'openBoard', boardId: b.id }))
  for (const rule of BOARD_RULES) {
    // On the start page a board command is understood but needs a board first.
    const result = rule(s, { ...ctx, board: ctx.board ?? { ...EMPTY } })
    if (result) return ctx.board ? result : { kind: 'needBoard' }
  }
  return { kind: 'unknown' }
}

/** A stand-in board for the start page, so rules can tell "a board command" from "unknown". */
const EMPTY: Board = {
  id: 0, title: '', labels: [], members: [], role: 'viewer', public: false, public_link: null, meeting_url: null,
  background: { kind: 'none', preset: null, version: 0 },
  columns: [{ id: 0, title: '', position: 0, cards: [] }],
}
