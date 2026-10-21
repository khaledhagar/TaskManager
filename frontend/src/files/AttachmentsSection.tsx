import { FileText, Paperclip, X } from 'lucide-react'
import { useEffect, useId, useState, type DragEvent } from 'react'
import type { Card } from '../api/boards'
import { files } from '../api/files'
import boardCss from '../board/cardWindow.module.css'
import type { BoardActions } from '../board/useBoard'
import { useI18n } from '../i18n/context'
import ui from '../ui/ui.module.css'
import css from './files.module.css'
import { ATTACHMENT_ACCEPT, attachmentError, formatSize, MAX_PER_CARD } from './uploads'

type Upload = { key: number; name: string; progress: number }

/** Card attachments: drop or choose files, see progress, preview images, download, delete. */
export function AttachmentsSection({ card, actions }: { card: Card; actions: BoardActions }) {
  const inputId = useId()
  const { t, rich } = useI18n()
  const [uploads, setUploads] = useState<Upload[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [confirmId, setConfirmId] = useState<number | null>(null)

  useEffect(() => {
    files.usage().then(setUsage, () => setUsage(null))
  }, [card.attachments.length])

  function start(list: File[]) {
    const problems: string[] = []
    let room = MAX_PER_CARD - card.attachments.length - uploads.length
    for (const file of list) {
      const problem = attachmentError(file) ?? (room <= 0 ? t('files.perCard', { count: MAX_PER_CARD }) : null)
      if (problem) {
        problems.push(`${file.name}: ${problem}`)
        continue
      }
      room -= 1
      send(file)
    }
    setErrors(problems)
  }

  function send(file: File) {
    const key = Math.random()
    const setProgress = (progress: number) =>
      setUploads((all) => all.map((u) => (u.key === key ? { ...u, progress } : u)))
    setUploads((all) => [...all, { key, name: file.name, progress: 0 }])
    files
      .attach(card.id, file, setProgress)
      .then((attachment) => actions.attachmentAdded(card.id, attachment))
      .catch((e: Error) => setErrors((all) => [...all, `${file.name}: ${e.message}`]))
      .finally(() => setUploads((all) => all.filter((u) => u.key !== key)))
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    start([...e.dataTransfer.files])
  }

  return (
    <section className={boardCss.section}>
      <div className={boardCss.sectionHead}>
        <h3 className={boardCss.sectionTitle}>{t('card.attachments')}</h3>
        {usage ? (
          <span className={ui.hint}>{t('files.usage', { used: formatSize(usage.used), limit: formatSize(usage.limit) })}</span>
        ) : null}
      </div>

      {card.attachments.length ? (
        <ul className={css.list}>
          {card.attachments.map((a) => (
            <li key={a.id} className={css.item}>
              {a.is_image ? (
                <img className={css.thumb} src={files.url(a.id, true)} alt="" loading="lazy" />
              ) : (
                <span className={css.icon} aria-hidden="true">
                  <FileText size={18} />
                </span>
              )}
              <span className={css.name}>
                <a href={files.url(a.id)} download={a.filename} dir="auto">
                  {a.filename}
                </a>
                <span className={ui.hint}>{formatSize(a.size)}</span>
              </span>
              {confirmId === a.id ? (
                <span className={boardCss.inline}>
                  <button
                    type="button"
                    className={`${ui.button} ${ui.danger}`}
                    onClick={() => {
                      setConfirmId(null)
                      actions.deleteAttachment(card.id, a.id)
                    }}
                  >
                    {t('files.deleteFile')}
                  </button>
                  <button type="button" className={`${ui.button} ${ui.ghost}`} onClick={() => setConfirmId(null)}>
                    {t('ui.keep')}
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className={boardCss.itemDelete}
                  aria-label={t('files.delete', { name: a.filename })}
                  onClick={() => setConfirmId(a.id)}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {uploads.map((u) => (
        <div key={u.key} className={css.upload}>
          <span className={css.name}>{u.name}</span>
          <div
            className={boardCss.bar}
            role="progressbar"
            aria-label={t('files.uploading', { name: u.name })}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(u.progress * 100)}
          >
            <span style={{ width: `${u.progress * 100}%` }} />
          </div>
        </div>
      ))}

      {errors.length ? (
        <ul className={`${ui.alert} ${css.errors}`} role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}

      <div
        className={css.drop}
        data-dragging={dragging || undefined}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <Paperclip size={16} aria-hidden="true" />
        <span>
          {rich('files.drop', {
            choose: (
              <label htmlFor={inputId} className={css.choose}>
                {t('files.choose')}
              </label>
            ),
          })}
        </span>
        <input
          id={inputId}
          type="file"
          multiple
          accept={ATTACHMENT_ACCEPT}
          className="visually-hidden"
          onChange={(e) => {
            start([...(e.target.files ?? [])])
            e.target.value = ''
          }}
        />
        <span className={ui.hint}>{t('files.hint')}</span>
      </div>
    </section>
  )
}
