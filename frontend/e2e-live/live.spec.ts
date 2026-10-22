import { expect, test, type Page } from '@playwright/test'
import { api, columnCards, getBoard, openBoard, startAsGuest } from '../e2e/helpers.ts'

/** Drag one card onto another with the mouse (dnd-kit needs several small moves). */
async function drag(page: Page, from: string, to: string) {
  const a = (await page.getByText(from, { exact: true }).boundingBox())!
  const b = (await page.getByText(to, { exact: true }).boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 15; i++) {
    await page.mouse.move(a.x + a.width / 2 + ((b.x - a.x) * i) / 15, a.y + a.height / 2 + ((b.y - a.y - 10) * i) / 15)
  }
  await page.waitForTimeout(150)
  await page.mouse.up()
  await page.waitForTimeout(400)
}

test('T-830 security headers, health, privacy page and signed-out API', async ({ request }) => {
  const home = await request.get('/')
  expect(home.status()).toBe(200)
  const headers = home.headers()
  expect(headers['content-security-policy']).toContain("default-src 'self'")
  expect(headers['strict-transport-security']).toContain('max-age=')
  expect(headers['x-content-type-options']).toBe('nosniff')
  expect(await (await request.get('/api/health')).json()).toEqual({ status: 'ok', database: 'ok' })
  expect((await request.get('/privacy')).status()).toBe(200)
  expect((await request.get('/api/boards')).status()).toBe(401)
  expect((await request.get('/api/nothing-here')).status()).toBe(404)
})

test('T-831 a guest works with a board on the live site, then deletes the account', async ({ page, context }) => {
  await startAsGuest(page)
  const session = (await context.cookies()).find((c) => c.name === 'session')!
  expect(session).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Lax' })

  const id = await openBoard(page, 'Live smoke', [['A1', 'A2'], ['B1']])
  await drag(page, 'A1', 'B1')
  const expected = [['A2'], ['A1', 'B1'], []]
  await expect.poll(() => columnCards(page)).toEqual(expected)
  await page.reload()
  await expect.poll(() => columnCards(page)).toEqual(expected)
  expect((await getBoard(page, id)).columns[1].cards.map((c) => c.title)).toEqual(['A1', 'B1'])

  await page.getByRole('button', { name: 'Switch to dark theme' }).click()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  await api(page, 'DELETE', '/api/auth/me')
  expect((await page.request.get('/api/auth/me')).status()).toBe(401)
})
