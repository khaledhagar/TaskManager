import { boards, type Board, type FocusStats, type Role } from '../api/boards'
import { t } from '../i18n/language'
import type { Show } from '../ui/toastContext'
import * as logic from './logic'

type Context = {
  boardId: number
  ref: { current: Board | null }
  commit: (board: Board) => void
  mutate: (apply: (b: Board) => Board, request: () => Promise<unknown>) => Promise<void>
  create: <T>(request: () => Promise<T>, apply: (b: Board, created: T) => Board) => Promise<T | null>
  allowed: (need: Role) => boolean
  reload: () => Promise<unknown>
  fail: (e: unknown) => void
  toast: Show
}

/** Archive, duplicate, WIP limits, auto-complete, covers and focus sessions (Phase 24). */
export function useOrganizeActions({ boardId, ref, commit, mutate, create, allowed, reload, fail, toast }: Context) {
  function restoreCard(cardId: number) {
    if (!allowed('editor')) return Promise.resolve(false)
    return boards.restoreCard(cardId).then(
      () => reload().then(() => true),
      (e) => {
        fail(e)
        return false
      },
    )
  }

  return {
    restoreCard,
    archiveCard: (cardId: number) => {
      if (!allowed('editor')) return
      const before = ref.current!
      commit(logic.removeCard(before, cardId))
      boards.archiveCard(cardId).then(
        () =>
          toast({
            message: t('archive.cardArchived'),
            action: { label: t('board.undo'), onClick: () => restoreCard(cardId) },
          }),
        (e) => {
          commit(before)
          fail(e)
        },
      )
    },
    duplicateCard: (cardId: number) => {
      if (!allowed('editor')) return
      const found = logic.findCard(ref.current!, cardId)!
      return create(
        () => boards.duplicateCard(cardId),
        (b, card) => logic.insertCard(b, found.column.id, found.index + 1, card),
      )
    },
    setWipLimit: (columnId: number, limit: number | null) =>
      allowed('editor') &&
      mutate(
        (b) => ({ ...b, columns: b.columns.map((c) => (c.id === columnId ? { ...c, wip_limit: limit } : c)) }),
        () => boards.setWipLimit(columnId, limit),
      ),
    setAutoComplete: (on: boolean) =>
      allowed('admin') &&
      mutate((b) => ({ ...b, auto_complete: on }), () => boards.setAutoComplete(boardId, on)),
    setCover: (cardId: number, attachmentId: number | null) =>
      allowed('editor') &&
      mutate(
        (b) => logic.updateCard(b, cardId, { cover_attachment_id: attachmentId }),
        () => boards.setCover(cardId, attachmentId),
      ),
    focusAdded: (cardId: number, stats: FocusStats) => commit(logic.updateCard(ref.current!, cardId, stats)),
  }
}
