import { useEffect, useState } from 'react'
import type { Board, Role } from '../api/boards'
import { collab, type Comment } from '../api/collab'
import { Markdown } from '../board/Markdown'
import { can } from '../board/permissions'
import { useI18n } from '../i18n/context'
import ui from '../ui/ui.module.css'
import { timeAgo } from './activityText'
import css from './collab.module.css'
import { MentionInput } from './MentionInput'

type Props = {
  cardId: number
  members: Board['members']
  role: Role
  userId: number
  onCountChange: (count: number) => void
}

/** Comments under a card: Viewers read; "Can update tasks" and above write (SEC-200). */
export function CommentsSection({ cardId, members, role, userId, onCountChange }: Props) {
  const { t } = useI18n()
  const [list, setList] = useState<Comment[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const canWrite = can(role, 'updater')

  useEffect(() => {
    collab.comments(cardId).then(setList, (e) => setError(e.message))
  }, [cardId])

  async function run(change: () => Promise<Comment[]>) {
    setError(null)
    try {
      const next = await change()
      setList(next)
      onCountChange(next.length)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  function send() {
    const text = draft.trim()
    if (!text) return
    run(async () => {
      const added = await collab.addComment(cardId, text)
      setDraft('')
      return [...list, added]
    })
  }

  return (
    <section className={css.section}>
      <h3 className={css.title}>{t('comments.title')}</h3>
      {error ? (
        <p className={ui.alert} role="alert">
          {error}
        </p>
      ) : null}
      {list.length === 0 ? <p className={ui.hint}>{t('comments.empty')}</p> : null}
      <ol className={css.comments}>
        {list.map((c) => (
          <CommentItem
            key={c.id}
            comment={c}
            members={members}
            mine={c.author_id === userId && canWrite}
            canDelete={(c.author_id === userId && canWrite) || role === 'admin'}
            onEdit={(text) => run(async () => {
              const edited = await collab.editComment(c.id, text)
              return list.map((x) => (x.id === c.id ? edited : x))
            })}
            onDelete={() => run(async () => {
              await collab.deleteComment(c.id)
              return list.filter((x) => x.id !== c.id)
            })}
          />
        ))}
      </ol>
      {canWrite ? (
        <div className={css.composer}>
          <MentionInput
            value={draft}
            onChange={setDraft}
            members={members}
            label={t('comments.label')}
            placeholder={t('comments.placeholder')}
            onSubmit={send}
          />
          <button type="button" className={`${ui.button} ${ui.primary}`} disabled={!draft.trim()} onClick={send}>
            {t('comments.send')}
          </button>
        </div>
      ) : (
        <p className={ui.hint}>{t('comments.viewOnly')}</p>
      )}
    </section>
  )
}

type ItemProps = {
  comment: Comment
  members: Board['members']
  mine: boolean
  canDelete: boolean
  onEdit: (text: string) => Promise<void>
  onDelete: () => Promise<void>
}

function CommentItem({ comment, members, mine, canDelete, onEdit, onDelete }: ItemProps) {
  const { t } = useI18n()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(comment.text)
  const [confirming, setConfirming] = useState(false)
  const author = mine ? t('activity.you') : (comment.author_email ?? t('activity.someone'))

  async function save() {
    if (!text.trim()) return
    await onEdit(text.trim())
    setEditing(false)
  }

  return (
    <li className={css.comment}>
      <div className={css.meta}>
        <span className={css.avatar} aria-hidden="true">
          {author.slice(0, 1).toUpperCase()}
        </span>
        <strong dir="ltr">{author}</strong>
        <time className={ui.hint} dateTime={comment.created_at}>
          {timeAgo(comment.created_at)}
        </time>
        {comment.edited_at ? <span className={ui.hint}>({t('comments.edited')})</span> : null}
      </div>
      {editing ? (
        <>
          <MentionInput value={text} onChange={setText} members={members} label={t('comments.editLabel')} onSubmit={save} autoFocus />
          <div className={css.actions}>
            <button type="button" className={`${ui.button} ${ui.primary}`} onClick={save}>
              {t('comments.save')}
            </button>
            <button type="button" className={`${ui.button} ${ui.ghost}`} onClick={() => setEditing(false)}>
              {t('ui.cancel')}
            </button>
          </div>
        </>
      ) : (
        <div className={css.body}>
          <Markdown text={comment.text} />
        </div>
      )}
      {!editing && (mine || canDelete) ? (
        <div className={css.actions}>
          {mine ? (
            <button type="button" className={ui.linkButton} onClick={() => setEditing(true)}>
              {t('comments.edit')}
            </button>
          ) : null}
          {canDelete && !confirming ? (
            <button type="button" className={ui.linkButton} onClick={() => setConfirming(true)}>
              {t('comments.delete')}
            </button>
          ) : null}
          {confirming ? (
            <>
              <span>{t('comments.deleteConfirm')}</span>
              <button type="button" className={`${ui.button} ${ui.danger}`} onClick={onDelete}>
                {t('comments.delete')}
              </button>
              <button type="button" className={`${ui.button} ${ui.ghost}`} onClick={() => setConfirming(false)}>
                {t('ui.cancel')}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}
