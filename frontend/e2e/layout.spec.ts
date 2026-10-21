import { expect, test, type Page } from '@playwright/test'
import { getBoard, openBoard, startAsGuest } from './helpers.ts'

const TEXT = {
  en: { guest: 'Continue as guest', board: 'Website Launch', card: /^Design pricing page/, ask: 'Ask AI', newBoard: 'New board', timer: 'Focus timer' },
  ar: { guest: 'المتابعة كضيف', board: 'إطلاق الموقع', card: /^تصميم صفحة الأسعار/, ask: 'اسأل الذكاء الاصطناعي', newBoard: 'لوحة جديدة', timer: 'مؤقت التركيز' },
}

/** Problems on the current screen: sideways page scroll, or visible controls outside the window. */
async function problems(page: Page, screen: string) {
  return page.evaluate((name) => {
    const found: string[] = []
    const extra = document.documentElement.scrollWidth - innerWidth
    if (extra > 0) found.push(`${name}: page scrolls sideways by ${extra}px`)
    const scope = document.querySelector('dialog[open], [role=dialog]') ?? document.querySelector('header') ?? document.body
    for (const el of scope.querySelectorAll('button, a[href], input, select, textarea')) {
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height || el.closest('[hidden], [class*=columns]')) continue
      if (r.left < -1 || r.right > innerWidth + 1) found.push(`${name}: ${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30)} is cut off`)
    }
    return found
  }, screen)
}

async function everyScreen(page: Page, lang: 'en' | 'ar', theme: string, width: number) {
  const L = TEXT[lang]
  await page.setViewportSize({ width, height: 860 })
  await page.addInitScript(([l, th]) => {
    localStorage.setItem('language', l)
    localStorage.setItem('theme', th)
  }, [lang, theme])
  await page.goto('/signin')
  const found = await problems(page, 'sign-in')
  await page.getByRole('button', { name: L.guest }).click()
  await expect(page.getByRole('heading', { name: L.board })).toBeVisible()
  found.push(...(await problems(page, 'board')))
  await page.getByRole('button', { name: L.card }).click()
  found.push(...(await problems(page, 'card')))
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: L.timer }).click()
  found.push(...(await problems(page, 'timer')))
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: L.ask }).click()
  found.push(...(await problems(page, 'chat')))
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: L.newBoard }).click()
  found.push(...(await problems(page, 'new board')))
  return found.map((p) => `${width}px ${theme} ${lang} ${p}`)
}

for (const lang of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark']) {
    test(`T-329 T-351 every main screen fits at 360, 768, 1024 and 1440 px (${lang}, ${theme})`, async ({ browser }) => {
      const found: string[] = []
      for (const width of [360, 768, 1024, 1440]) {
        const context = await browser.newContext({ hasTouch: width <= 1024 })
        found.push(...(await everyScreen(await context.newPage(), lang, theme, width)))
        await context.close()
      }
      expect(found).toEqual([])
    })
  }
}

test('T-335 touch drag and drop on a phone; a quick swipe still scrolls', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const page = await context.newPage()
  await startAsGuest(page)
  const id = await openBoard(page, 'Touch', [['T1', 'T2'], []])
  const cdp = await context.newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })

  // Press and hold, then move to the second column (partly visible at the right edge).
  const a = (await page.getByText('T1', { exact: true }).boundingBox())!
  const target = (await page.getByRole('region', { name: 'In Progress' }).boundingBox())!
  const [x0, y0] = [a.x + 20, a.y + a.height / 2]
  await touch('touchStart', x0, y0)
  await page.waitForTimeout(400)
  for (let i = 1; i <= 15; i++) await touch('touchMove', x0 + ((target.x + 30 - x0) * i) / 15, y0 + 40 * (i / 15))
  await page.waitForTimeout(150)
  await touch('touchEnd', 0, 0)
  // Holding near the screen edge scrolls the board, so the card may land one column further.
  const placed = async () => (await getBoard(page, id)).columns.map((c) => c.cards.map((x) => x.title))
  await expect.poll(async () => (await placed())[0]).toEqual(['T2'])
  expect((await placed()).flat()).toContain('T1')

  // A quick swipe (no hold) scrolls the columns back instead of dragging a card.
  const columns = page.locator('[class*=columns]').first()
  const before = await columns.evaluate((el) => el.scrollLeft)
  const box = (await columns.boundingBox())!
  const [sx, sy] = [100, box.y + 60]
  await touch('touchStart', sx, sy)
  for (let i = 1; i <= 8; i++) await touch('touchMove', sx + i * 25, sy)
  await touch('touchEnd', 0, 0)
  await expect.poll(() => columns.evaluate((el) => el.scrollLeft)).toBeLessThan(before)
  expect((await getBoard(page, id)).columns[0].cards.map((c) => c.title)).toEqual(['T2'])
})
