import { LayoutTemplate, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { boards, type BoardSummary, type UserTemplate } from '../api/boards'
import { templates } from '../api/templates'
import { useI18n } from '../i18n/context'
import { Dialog } from '../ui/Dialog'
import dialog from '../ui/dialog.module.css'
import { useToast } from '../ui/toastContext'
import ui from '../ui/ui.module.css'
import css from './start.module.css'

/** Start page: boards you saved as templates; one click starts a new board, or deletes one. */
export function TemplateTiles({ onCreated }: { onCreated: (board: BoardSummary) => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const [own, setOwn] = useState<UserTemplate[]>([])
  const [deleting, setDeleting] = useState<UserTemplate | null>(null)

  useEffect(() => {
    templates.list().then(setOwn, () => setOwn([]))
  }, [])

  function use(template: UserTemplate) {
    boards.createFromTemplate(template.name, template.id).then(onCreated, (e: Error) => toast({ message: e.message, tone: 'error' }))
  }

  async function remove(template: UserTemplate) {
    setDeleting(null)
    try {
      await templates.remove(template.id)
      setOwn((all) => all.filter((x) => x.id !== template.id))
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    }
  }

  if (!own.length) return null
  return (
    <section className={css.group} aria-labelledby="your-templates">
      <h2 id="your-templates" className={css.groupTitle}>
        {t('start.templates')}
      </h2>
      <ul className={css.tiles}>
        {own.map((x) => (
          <li key={x.id} className={css.templateTile}>
            <span className={css.tileTitle} dir="auto">
              <LayoutTemplate size={16} aria-hidden="true" />
              {x.name}
            </span>
            <span className={css.templateActions}>
              <button
                type="button"
                className={`${ui.button} ${ui.secondary}`}
                aria-label={t('start.useTemplateFor', { name: x.name })}
                onClick={() => use(x)}
              >
                {t('start.useTemplate')}
              </button>
              <button
                type="button"
                className={ui.iconButton}
                aria-label={t('newBoard.deleteTemplate', { name: x.name })}
                title={t('newBoard.deleteTemplate', { name: x.name })}
                onClick={() => setDeleting(x)}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </span>
          </li>
        ))}
      </ul>
      <Dialog open={deleting !== null} onClose={() => setDeleting(null)} title={t('template.deleteTitle')}>
        <p>{t('template.deleteBody', { name: deleting?.name ?? '' })}</p>
        <div className={dialog.actions}>
          <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={() => setDeleting(null)}>
            {t('ui.cancel')}
          </button>
          <button type="button" className={`${ui.button} ${ui.danger}`} onClick={() => remove(deleting!)}>
            {t('template.delete')}
          </button>
        </div>
      </Dialog>
    </section>
  )
}
