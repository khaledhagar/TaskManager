import { expect, test, type Page } from '@playwright/test'
import { getBoard, openBoard, openExampleBoard, seedCards, signUp, startAsGuest, openFirstBoard } from './helpers.ts'

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
  await openFirstBoard(page, L.board)
  await seedCards(page, [[lang === 'en' ? 'Design pricing page' : 'تصميم صفحة الأسعار']])
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

test('T-335 touch drag and drop on a phone, where columns stack; a quick swipe still scrolls', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const page = await context.newPage()
  await startAsGuest(page)
  // Enough cards that the stacked columns are taller than the phone screen.
  const id = await openBoard(page, 'Touch', [['T1', 'T2', 'T3', 'T4', 'T5', 'T6'], []])
  const cdp = await context.newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })

  // Press and hold a card, then move it down into the next column (stacked below).
  const a = (await page.getByText('T1', { exact: true }).boundingBox())!
  const target = (await page.getByRole('region', { name: 'In Progress' }).boundingBox())!
  expect(target.y).toBeGreaterThan(a.y)
  const [x0, y0] = [a.x + 20, a.y + a.height / 2]
  await touch('touchStart', x0, y0)
  await page.waitForTimeout(400)
  for (let i = 1; i <= 15; i++) await touch('touchMove', x0, y0 + ((target.y + 60 - y0) * i) / 15)
  await page.waitForTimeout(150)
  await touch('touchEnd', 0, 0)
  const placed = async () => (await getBoard(page, id)).columns.map((c) => c.cards.map((x) => x.title))
  // Holding near the screen edge scrolls the page, so the card may land one column further.
  await expect.poll(async () => (await placed())[0]).toEqual(['T2', 'T3', 'T4', 'T5', 'T6'])
  expect((await placed()).slice(1).flat()).toContain('T1')

  // A quick swipe (no hold) scrolls the page instead of dragging a card.
  await page.evaluate(() => scrollTo(0, 0))
  const before = await page.evaluate(() => scrollY)
  const card = (await page.getByText('T3', { exact: true }).boundingBox())!
  await touch('touchStart', card.x + 20, card.y + 10)
  for (let i = 1; i <= 8; i++) await touch('touchMove', card.x + 20, card.y + 10 - i * 30)
  await touch('touchEnd', 0, 0)
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before)
  expect((await placed())[0]).toEqual(['T2', 'T3', 'T4', 'T5', 'T6'])
})

test('T-850 a board with a background, focus timer and meeting link fits a phone in both languages', async ({ page }) => {
  const email = await signUp(page)
  await openExampleBoard(page, email)
  await page.getByRole('button', { name: 'Board options' }).click()
  await page.getByRole('menuitem', { name: 'Change background' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Dusk' }).click()
  await expect(page.getByText('Saving...')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Board options' }).click()
  await page.getByRole('menuitem', { name: 'Members' }).click()
  await page.getByLabel('Meeting link (Zoom, Google Meet, Teams)').fill('https://zoom.us/j/123456789')
  await page.getByRole('button', { name: 'Save link' }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Focus timer' }).click()
  await page.keyboard.press('Escape')
  const found: string[] = []
  for (const lang of ['en', 'ar']) {
    if (lang === 'ar') await page.getByRole('button', { name: 'العربية' }).click()
    for (const width of [360, 390]) {
      await page.setViewportSize({ width, height: 800 })
      await page.waitForTimeout(300)
      found.push(...(await problems(page, `${width}px ${lang} board with background`)))
    }
  }
  expect(found).toEqual([])
})
