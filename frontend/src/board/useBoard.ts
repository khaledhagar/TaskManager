import { useCallback, useEffect, useRef, useState } from 'react'
import { boards, type Board, type Card, type CardPatch, type LabelColor } from '../api/boards'
import { useToast } from '../ui/toastContext'
import * as logic from './logic'

export const UNDO_MS = 5000
const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

type Pending = { timer: ReturnType<typeof setTimeout>; run: () => Promise<unknown> }

/**
 * Board state with optimistic edits. A failed request restores the previous state at once
 * and then reloads the board from the server. Deletes wait UNDO_MS so they can be undone.
 */
export function useBoard(boardId: number) {
  const toast = useToast()
  const [board, setBoard] = useState<Board | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const ref = useRef<Board | null>(null)
  const pending = useRef(new Map<string, Pending>())

  const commit = useCallback((next: Board) => {
    ref.current = next
    setBoard(next)
  }, [])

  const reload = useCallback(
    () => boards.get(boardId).then(commit, (e) => setLoadError(message(e))),
    [boardId, commit],
  )

  useEffect(() => {
    reload()
    const queue = pending.current
    return () => {
      // Leaving the board: carry out deletes that are still waiting for Undo.
      for (const item of queue.values()) {
        clearTimeout(item.timer)
        item.run().catch(() => {})
      }
      queue.clear()
    }
  }, [reload])

  const fail = useCallback(
    (e: unknown) => {
      toast({ message: message(e), tone: 'error' })
      reload()
    },
    [toast, reload],
  )

  async function mutate(apply: (b: Board) => Board, request: () => Promise<unknown>) {
    const before = ref.current!
    commit(apply(before))
    try {
      await request()
    } catch (e) {
      commit(before)
      fail(e)
    }
  }

  async function create<T>(request: () => Promise<T>, apply: (b: Board, created: T) => Board) {
    try {
      const created = await request()
      commit(apply(ref.current!, created))
      return created
    } catch (e) {
      fail(e)
      return null
    }
  }

  function deleteLater(key: string, label: string, run: () => Promise<unknown>, undo: () => void) {
    const timer = setTimeout(() => {
      pending.current.delete(key)
      run().catch(fail)
    }, UNDO_MS)
    pending.current.set(key, { timer, run })
    toast({
      message: label,
      duration: UNDO_MS,
      action: {
        label: 'Undo',
        onClick: () => {
          clearTimeout(timer)
          pending.current.delete(key)
          undo()
        },
      },
    })
  }

  const withCard = (cardId: number, fn: (card: Card) => Partial<Card>) => (b: Board) =>
    logic.updateCard(b, cardId, fn(logic.findCard(b, cardId)!.card))

  const actions = {
    renameBoard: (title: string) =>
      mutate((b) => ({ ...b, title }), () => boards.rename(boardId, title)),

    addColumn: (title: string) =>
      create(
        () => boards.addColumn(boardId, title),
        (b, column) => logic.insertColumn(b, b.columns.length, column),
      ),
    renameColumn: (columnId: number, title: string) =>
      mutate(
        (b) => ({ ...b, columns: b.columns.map((c) => (c.id === columnId ? { ...c, title } : c)) }),
        () => boards.renameColumn(columnId, title),
      ),
    reorderColumns: (columnIds: number[]) =>
      mutate((b) => logic.reorderColumns(b, columnIds), () => boards.reorderColumns(boardId, columnIds)),
    deleteColumn: (columnId: number) => {
      const b = ref.current!
      const index = b.columns.findIndex((c) => c.id === columnId)
      const column = b.columns[index]
      commit(logic.removeColumn(b, columnId))
      deleteLater(
        `column-${columnId}`,
        `Column "${column.title}" deleted`,
        () => boards.removeColumn(columnId),
        () => commit(logic.insertColumn(ref.current!, index, column)),
      )
    },

    addCard: (columnId: number, title: string) =>
      create(
        () => boards.addCard(columnId, title),
        (b, card) => logic.insertCard(b, columnId, Infinity, card),
      ),
    updateCard: (cardId: number, changes: CardPatch) =>
      mutate((b) => logic.updateCard(b, cardId, changes), () => boards.updateCard(cardId, changes)),
    moveCard: (cardId: number, columnId: number, index: number) =>
      mutate(
        (b) => logic.moveCard(b, cardId, columnId, index),
        () => boards.moveCard(cardId, columnId, index),
      ),
    deleteCard: (cardId: number) => {
      const found = logic.findCard(ref.current!, cardId)!
      commit(logic.removeCard(ref.current!, cardId))
      deleteLater(
        `card-${cardId}`,
        'Card deleted',
        () => boards.removeCard(cardId),
        () => commit(logic.insertCard(ref.current!, found.column.id, found.index, found.card)),
      )
    },
    setCardLabels: (cardId: number, labelIds: number[]) =>
      mutate(
        (b) => logic.updateCard(b, cardId, { label_ids: labelIds }),
        () => boards.setCardLabels(cardId, labelIds),
      ),

    addItem: (cardId: number, text: string) =>
      create(
        () => boards.addItem(cardId, text),
        (b, item) => withCard(cardId, (c) => ({ checklist: [...c.checklist, item] }))(b),
      ),
    updateItem: (cardId: number, itemId: number, changes: { text?: string; done?: boolean }) =>
      mutate(
        withCard(cardId, (c) => ({
          checklist: c.checklist.map((i) => (i.id === itemId ? { ...i, ...changes } : i)),
        })),
        () => boards.updateItem(itemId, changes),
      ),
    deleteItem: (cardId: number, itemId: number) =>
      mutate(
        withCard(cardId, (c) => ({
          checklist: c.checklist
            .filter((i) => i.id !== itemId)
            .map((i, position) => ({ ...i, position })),
        })),
        () => boards.removeItem(itemId),
      ),

    addLabel: (name: string, color: LabelColor) =>
      create(() => boards.addLabel(boardId, name, color), (b, label) => ({ ...b, labels: [...b.labels, label] })),
    deleteLabel: (labelId: number) =>
      mutate(
        (b) => ({
          ...b,
          labels: b.labels.filter((l) => l.id !== labelId),
          columns: b.columns.map((col) => ({
            ...col,
            cards: col.cards.map((c) => ({ ...c, label_ids: c.label_ids.filter((id) => id !== labelId) })),
          })),
        }),
        () => boards.removeLabel(labelId),
      ),
  }

  return { board, loadError, actions }
}

export type BoardActions = ReturnType<typeof useBoard>['actions']
