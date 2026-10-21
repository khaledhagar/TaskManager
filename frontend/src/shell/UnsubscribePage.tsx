import { useEffect, useState } from 'react'
import { notifications } from '../api/notifications'
import { AuthLayout } from '../auth/AuthLayout'
import { useI18n } from '../i18n/context'
import { Link } from '../ui/Link'

/** /unsubscribe#token=...: the link at the end of every email turns emails off, no sign-in needed. */
export function UnsubscribePage() {
  const { t } = useI18n()
  const [state, setState] = useState<'working' | 'done' | 'invalid'>('working')

  useEffect(() => {
    const token = new URLSearchParams(location.hash.slice(1)).get('token') ?? ''
    notifications.unsubscribe(token).then(
      () => setState('done'),
      () => setState('invalid'),
    )
  }, [])

  if (state === 'working') return <div role="status" aria-label={t('app.loading')} />
  return (
    <AuthLayout title={t('unsubscribe.title')} intro={t(state === 'done' ? 'unsubscribe.done' : 'unsubscribe.invalid')}>
      <Link to="/">{t('invite.home')}</Link>
    </AuthLayout>
  )
}
