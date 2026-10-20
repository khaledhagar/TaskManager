import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { I18nProvider } from './i18n/I18n'
import { applyLanguage, initialLanguage } from './i18n/language'
import { ToastProvider } from './ui/Toast'
import './index.css'
import { applyTheme, initialTheme } from './lib/theme'

applyTheme(initialTheme())
applyLanguage(initialLanguage())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </I18nProvider>
  </StrictMode>,
)
