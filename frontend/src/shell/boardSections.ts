import type { BoardSummary } from '../api/boards'

/** Starred boards, then your boards, then boards shared with you; archived boards last. */
export function boardSections(boards: BoardSummary[]) {
  const active = boards.filter((b) => !b.archived)
  return {
    starred: active.filter((b) => b.starred),
    own: active.filter((b) => !b.starred && b.role === 'admin'),
    shared: active.filter((b) => !b.starred && b.role !== 'admin'),
    archived: boards.filter((b) => b.archived),
  }
}

/** The board to open when none is chosen: the first one in the switcher. */
export function firstBoard(boards: BoardSummary[]): BoardSummary | undefined {
  const s = boardSections(boards)
  return [...s.starred, ...s.own, ...s.shared, ...s.archived][0]
}
