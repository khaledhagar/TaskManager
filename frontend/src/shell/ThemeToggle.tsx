import { Moon, Sun } from 'lucide-react'
import { useI18n } from '../i18n/context'
import { useTheme } from '../lib/theme'
import ui from '../ui/ui.module.css'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const { t } = useI18n()
  const label = t(theme === 'dark' ? 'theme.toLight' : 'theme.toDark')
  return (
    <button
      type="button"
      className={ui.iconButton}
      aria-label={label}
      title={label}
      onClick={toggle}
    >
      {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  )
}
