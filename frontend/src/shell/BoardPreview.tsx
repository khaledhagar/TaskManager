import { useEffect, useState } from 'react'
import { boards, type Board } from '../api/boards'
import ui from '../ui/ui.module.css'
import css from './shell.module.css'

/** Read-only board view; replaced by the interactive board in Phase 8. */
export function BoardPreview({ boardId }: { boardId: number }) {
  const [board, setBoard] = useState<Board | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    boards.get(boardId).then(setBoard, (e) => setError(e.message))
  }, [boardId])

  if (error)
    return (
      <p className={ui.alert} role="alert">
        {error}
      </p>
    )
  if (!board) return <div className={css.skeleton} aria-label="Loading board" role="status" />

  return (
    <section className={css.board}>
      <h1 className={css.boardTitle}>{board.title}</h1>
      <div className={css.columns}>
        {board.columns.map((column) => (
          <div key={column.id} className={css.column}>
            <h2 className={css.columnTitle}>
              {column.title} <span className={css.count}>{column.cards.length}</span>
            </h2>
            {column.cards.map((card) => (
              <div key={card.id} className={css.card}>
                {card.title}
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
