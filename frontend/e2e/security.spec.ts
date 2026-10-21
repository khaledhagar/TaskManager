import { expect, test, type Page } from '@playwright/test'
import { api, card, openBoard, seedCards, startAsGuest } from './helpers.ts'

/** Collect browser dialogs (alert, confirm) that fire on the page. */
function watchDialogs(page: Page) {
  const fired: string[] = []
  page.on('dialog', async (d) => {
    fired.push(d.message())
    await d.dismiss()
  })
  return fired
}

test('T-330 user B cannot open user A\'s board by URL', async ({ page, browser }) => {
  await startAsGuest(page)
  const id = await openBoard(page, 'Private plans', [['Secret card']])
  const other = await (await browser.newContext()).newPage()
  await startAsGuest(other)
  const status = await other.evaluate(async (boardId) => (await fetch(`/api/boards/${boardId}`)).status, id)
  expect(status).toBe(404)
  await other.goto(`/?board=${id}`)
  await expect(other.getByRole('alert')).toBeVisible()
  await expect(other.getByText('Secret card')).toHaveCount(0)
  await expect(other.getByText('Private plans')).toHaveCount(0)
})

test('T-331 the session cookie is not readable from document.cookie', async ({ page, context }) => {
  await startAsGuest(page)
  const cookies = await context.cookies()
  const session = cookies.find((c) => c.httpOnly)
  expect(session).toBeTruthy()
  expect(session!.sameSite).toBe('Lax')
  expect(await page.evaluate(() => document.cookie)).not.toContain(session!.name)
})

test('T-332 a card title with HTML renders as text and runs nothing', async ({ page }) => {
  const fired = watchDialogs(page)
  await startAsGuest(page)
  const title = '<img src=x onerror=alert(1)>'
  await openBoard(page, 'XSS title', [[title]])
  await expect(page.getByText(title, { exact: true })).toBeVisible()
  await card(page, '<img').click()
  await expect(page.getByRole('dialog').getByLabel('Title')).toHaveValue(title)
  expect(await page.locator('img[src="x"]').count()).toBe(0)
  expect(fired).toEqual([])
})

test('T-333 a javascript: link in a description does nothing', async ({ page }) => {
  const fired = watchDialogs(page)
  await startAsGuest(page)
  const id = await openBoard(page, 'XSS link', [['Linky']])
  const board = await api<{ columns: { cards: { id: number }[] }[] }>(page, 'GET', `/api/boards/${id}`)
  await api(page, 'PATCH', `/api/cards/${board.columns[0].cards[0].id}`, { details: '[click me](javascript:alert(1))' })
  await page.reload()
  await card(page, 'Linky').click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Preview' }).click()
  const link = dialog.getByText('click me')
  await expect(link).toBeVisible()
  expect(await link.evaluate((el) => el.closest('a')?.getAttribute('href') ?? '')).not.toMatch(/javascript/i)
  await link.click()
  await page.waitForTimeout(300)
  expect(fired).toEqual([])
})

test('T-334 no CSP violations on any screen', async ({ page }) => {
  const violations: string[] = []
  page.on('console', (m) => /Content.Security.Policy|Refused to/i.test(m.text()) && violations.push(m.text()))
  await page.addInitScript(() =>
    document.addEventListener('securitypolicyviolation', (e: SecurityPolicyViolationEvent) => console.error(`Refused to load: CSP ${e.violatedDirective} ${e.blockedURI}`)),
  )
  await page.goto('/signin')
  await page.getByRole('link', { name: 'Create an account' }).click()
  await page.goto('/forgot-password')
  await startAsGuest(page)
  await seedCards(page, [['Design pricing page']])
  await card(page, 'Design pricing page').click()
  await page.getByRole('dialog').getByRole('button', { name: 'Preview' }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Ask AI' }).click()
  await page.getByRole('button', { name: 'New board' }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Board options' }).click()
  await page.getByRole('menuitem', { name: 'Change background' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Dusk' }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Focus timer' }).click()
  await page.getByRole('button', { name: 'Switch to dark theme' }).click()
  await page.getByRole('button', { name: 'العربية' }).click()
  await page.waitForTimeout(500)
  expect(violations).toEqual([])
})
