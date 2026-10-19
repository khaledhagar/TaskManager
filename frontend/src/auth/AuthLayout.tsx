import type { ReactNode } from 'react'
import { Logo } from '../ui/Logo'
import css from './auth.module.css'
import { WallPreview } from './WallPreview'

/** Split screen: the brand wall on the left (hidden on small screens), the form on the right. */
export function AuthLayout({ title, intro, children }: {
  title: string
  intro?: ReactNode
  children: ReactNode
}) {
  return (
    <div className={css.layout}>
      <aside className={css.brand}>
        <Logo inverted />
        <div className={css.brandCopy}>
          <p className={css.brandHeadline}>Plan the work. Move the cards. Finish.</p>
          <p className={css.brandSub}>
            Boards, checklists and an AI assistant that turns a sentence into a plan.
          </p>
        </div>
        <WallPreview />
      </aside>
      <main className={css.panel}>
        <div className={css.form}>
          <div className={css.mobileLogo}>
            <Logo />
          </div>
          <h1 className={css.title}>{title}</h1>
          {intro ? <div className={css.intro}>{intro}</div> : null}
          {children}
        </div>
      </main>
    </div>
  )
}
