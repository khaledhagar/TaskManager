import { expect, test } from '@playwright/test'
import { card, openBoard, startAsGuest } from './helpers.ts'

test.beforeEach(async ({ page }) => startAsGuest(page))

test('NFR-12 every control reached with Tab shows a visible focus ring', async ({ page }) => {
  await page.locator('body').click({ position: { x: 5, y: 300 } })
  const missing: string[] = []
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab')
    const ring = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement
      if (el === document.body) return null
      // The search box draws its ring on the wrapping label (:focus-within).
      const ringed = [el, el.closest('label')].filter((x): x is HTMLElement => x !== null)
      const visible = ringed.some((x) => {
        const s = getComputedStyle(x)
        return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none'
      })
      return visible ? null : `${el.tagName} ${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30)}`
    })
    if (ring) missing.push(ring)
  }
  expect(missing).toEqual([])
})

test('NFR-14 a live region announces drag results and toasts', async ({ page }) => {
  await openBoard(page, 'Announce', [['Say it'], []])
  await card(page, 'Say it').focus()
  await page.keyboard.press('Space')
  await page.waitForTimeout(200)
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(200)
  await page.keyboard.press('Space')
  await expect(page.locator('[aria-live]').filter({ hasText: /Dropped card Say it/ })).toHaveCount(1)
  await expect(card(page, 'Say it')).toHaveCount(1)
  await card(page, 'Say it').click()
  await page.getByRole('button', { name: 'Delete card' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Card deleted' })).toBeVisible()
})

test('NFR-21 a failed save shows an error and the change rolls back', async ({ page }) => {
  await openBoard(page, 'Offline', [['Fragile']])
  await page.route('**/api/cards/*', (route) =>
    route.request().method() === 'PATCH' ? route.fulfill({ status: 500, json: { detail: 'boom' } }) : route.continue(),
  )
  const check = page.getByRole('checkbox', { name: 'Completed: Fragile' })
  await check.click()
  await expect(page.getByRole('alert').or(page.getByRole('status')).filter({ hasText: /went wrong|boom/ })).toBeVisible()
  await expect(check).toHaveAttribute('aria-checked', 'false')
})
