import type { Background } from '../api/boards'
import { files } from '../api/files'
import css from './files.module.css'

/** Full-screen layer behind the board: a preset gradient or the photo, with a dim layer for contrast. */
export function Backdrop({ boardId, background }: { boardId: number; background: Background }) {
  if (background.kind === 'none') return null
  const style =
    background.kind === 'image'
      ? { backgroundImage: `url(${files.backgroundUrl(boardId, background.version)})` }
      : undefined
  return (
    <div className={css.backdrop} data-preset={background.preset ?? undefined} style={style} aria-hidden="true">
      <div className={css.dim} data-testid="dim" />
    </div>
  )
}
