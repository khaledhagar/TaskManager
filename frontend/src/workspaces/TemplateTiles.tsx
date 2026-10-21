import { LayoutTemplate } from 'lucide-react'
import { useEffect, useState } from 'react'
import { boards, type BoardSummary, type UserTemplate } from '../api/boards'
import { templates } from '../api/templates'
import { useI18n } from '../i18n/context'
import { useToast } from '../ui/toastContext'
import ui from '../ui/ui.module.css'
import css from './start.module.css'

/** Start page: boards you saved as templates; one click starts a new board from one. */
export function TemplateTiles({ onCreated }: { onCreated: (board: BoardSummary) => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const [own, setOwn] = useState<UserTemplate[]>([])

  useEffect(() => {
    templates.list().then(setOwn, () => setOwn([]))
  }, [])

  function use(template: UserTemplate) {
    boards.createFromTemplate(template.name, template.id).then(onCreated, (e: Error) => toast({ message: e.message, tone: 'error' }))
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
            <button
              type="button"
              className={`${ui.button} ${ui.secondary}`}
              aria-label={t('start.useTemplateFor', { name: x.name })}
              onClick={() => use(x)}
            >
              {t('start.useTemplate')}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
