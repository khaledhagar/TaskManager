import { useState, type FormEvent } from 'react'
import type { Board } from '../api/boards'
import { sharing } from '../api/sharing'
import { useI18n } from '../i18n/context'
import { Field } from '../ui/Field'
import ui from '../ui/ui.module.css'
import { ShareLink } from './ShareLink'
import css from './sharing.module.css'

type Links = Pick<Board, 'id' | 'title' | 'public' | 'public_link' | 'meeting_url'>
type Props = { board: Links; onChange: (changes: Partial<Links>) => void }

const isHttps = (url: string) => {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

/** Admin only: the public read-only link and the meeting link. */
export function BoardLinks({ board, onChange }: Props) {
  const { t } = useI18n()
  const [meeting, setMeeting] = useState(board.meeting_url ?? '')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function run(change: () => Promise<void>) {
    setError(null)
    setNotice(null)
    try {
      await change()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  // The switch moves at once; if saving fails it goes back and the error shows.
  const togglePublic = (isPublic: boolean) => {
    const before = { public: board.public, public_link: board.public_link }
    onChange({ public: isPublic, public_link: null })
    run(async () => {
      try {
        const result = await sharing.setVisibility(board.id, isPublic)
        onChange({ public: result.public, public_link: result.link })
      } catch (e) {
        onChange(before)
        throw e
      }
    })
  }

  const saveMeeting = (url: string | null) =>
    run(async () => {
      onChange({ meeting_url: (await sharing.setMeeting(board.id, url)).url })
      setMeeting(url ?? '')
    })

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!isHttps(meeting.trim())) return setError(t('meeting.invalid'))
    saveMeeting(meeting.trim())
  }

  return (
    <>
      <section className={css.section}>
        <h3 className={css.sectionTitle}>{t('visibility.title')}</h3>
        <label className={css.switch}>
          <input type="checkbox" checked={board.public} onChange={(e) => togglePublic(e.target.checked)} />
          <span>{t('visibility.toggle')}</span>
        </label>
        {board.public && board.public_link ? (
          <ShareLink link={board.public_link} boardTitle={board.title} note={t('visibility.note')} message="share.publicMessage" linkLabel="share.publicLink" />
        ) : (
          <p className={ui.hint}>{t('visibility.private')}</p>
        )}
      </section>
      <section className={css.section}>
        <h3 className={css.sectionTitle}>{t('meeting.title')}</h3>
        <form className={css.inviteForm} onSubmit={submit} noValidate>
          <Field
            label={t('meeting.label')}
            type="url"
            dir="ltr"
            value={meeting}
            onChange={(e) => setMeeting(e.target.value)}
            hint={t('meeting.hint')}
          />
          <button className={`${ui.button} ${ui.secondary}`}>{t('meeting.save')}</button>
        </form>
        {board.meeting_url ? (
          <div className={css.shareActions}>
            <a className={`${ui.button} ${ui.secondary}`} href={board.meeting_url} target="_blank" rel="noopener noreferrer">
              {t('meeting.start')}
            </a>
            <button
              type="button"
              className={`${ui.button} ${ui.primary}`}
              onClick={() => run(async () => {
                await sharing.emailMeeting(board.id)
                setNotice(t('meeting.sent'))
              })}
            >
              {t('meeting.email')}
            </button>
            <button type="button" className={ui.linkButton} onClick={() => saveMeeting(null)}>
              {t('meeting.remove')}
            </button>
          </div>
        ) : null}
        {notice ? (
          <p className={ui.notice} role="status">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p className={ui.alert} role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </>
  )
}
