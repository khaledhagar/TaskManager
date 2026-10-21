import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { card } from './helpers.ts'

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/** axe violations on the page, as "rule: target" strings. */
async function violations(page: Page, screen: string) {
  const result = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  return result.violations.flatMap((v) => v.nodes.map((n) => `${screen} ${v.id}: ${n.target.join(' ')}`))
}

/** Auth screen, board, card window and chat panel, in one theme and language. */
async function auditScreens(page: Page, theme: string, lang: 'en' | 'ar') {
  const L = lang === 'en'
    ? { guest: 'Continue as guest', card: 'Design pricing page', ask: 'Ask AI', board: 'Website Launch' }
    : { guest: 'المتابعة كضيف', card: 'تصميم صفحة الأسعار', ask: 'اسأل الذكاء الاصطناعي', board: 'إطلاق الموقع' }
  await page.addInitScript(([l, th]) => {
    localStorage.setItem('language', l)
    localStorage.setItem('theme', th)
  }, [lang, theme])
  await page.goto('/signin')
  const found = await violations(page, 'auth')
  await page.getByRole('button', { name: L.guest }).click()
  await expect(page.getByRole('heading', { name: L.board })).toBeVisible()
  found.push(...(await violations(page, 'board')))
  await card(page, L.card).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  found.push(...(await violations(page, 'card')))
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: L.ask }).click()
  found.push(...(await violations(page, 'chat')))
  return found
}

for (const theme of ['light', 'dark']) {
  test(`T-350 no axe violations on auth, board, card window and chat (${theme})`, async ({ page }) => {
    expect(await auditScreens(page, theme, 'en')).toEqual([])
  })
  test(`T-336 no axe violations in Arabic (${theme})`, async ({ page }) => {
    expect(await auditScreens(page, theme, 'ar')).toEqual([])
  })
}

test('T-352 a modal traps focus and returns focus to its trigger', async ({ page }) => {
  await page.goto('/signin')
  await page.getByRole('button', { name: 'Continue as guest' }).click()
  const trigger = card(page, 'Design pricing page')
  await trigger.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab')
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('T-353 reduced motion turns animations off', async ({ browser }) => {
  const page = await (await browser.newContext({ reducedMotion: 'reduce' })).newPage()
  await page.goto('/signin')
  await page.getByRole('button', { name: 'Continue as guest' }).click()
  await card(page, 'Design pricing page').click()
  const durations = await page.evaluate(() =>
    [...document.querySelectorAll('*')].flatMap((el) => {
      const s = getComputedStyle(el)
      return [s.animationDuration, s.transitionDuration].flatMap((d) => d.split(',')).map((d) => parseFloat(d) * (d.includes('ms') ? 1 : 1000))
    }),
  )
  expect(Math.max(...durations)).toBeLessThanOrEqual(10)
})
