import AxeBuilder from '@axe-core/playwright'
import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { openBoard, seedCards, startAsGuest, openFirstBoard } from './helpers.ts'

const titles = (page: import('@playwright/test').Page) =>
  page.getByRole('region', { name: /^Cards on/ }).locator('tbody tr td:first-child').allTextContents()

test('T-709 switch to the list, sort it, open a card from it @smoke', async ({ page }) => {
  await startAsGuest(page)
  await openBoard(page, 'Listing', [['beta', 'Alpha'], ['gamma'], []])
  await page.getByRole('group', { name: 'View' }).getByRole('button', { name: 'List' }).click()
  await expect(page).toHaveURL(/view=list/)
  expect(await titles(page)).toEqual(['beta', 'Alpha', 'gamma'])
  await page.getByRole('button', { name: 'Title', exact: true }).click()
  expect(await titles(page)).toEqual(['Alpha', 'beta', 'gamma'])
  await page.reload()
  await expect(page.getByRole('region', { name: 'Cards on Listing' })).toBeVisible()
  await page.getByRole('button', { name: 'gamma', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'gamma' })).toBeVisible()
})

test('T-710 T-766 download the board as CSV (laid out like the board) and JSON', async ({ page }) => {
  await startAsGuest(page)
  await openBoard(page, 'Export me', [['=SUM(A1)', 'Plain card'], [], []])
  const menu = async (item: string) => {
    await page.getByRole('button', { name: 'Board options' }).click()
    const download = page.waitForEvent('download')
    await page.getByRole('menuitem', { name: item }).click()
    return download
  }
  const csv = await menu('Download CSV (Excel)')
  expect(csv.suggestedFilename()).toBe('Export me.csv')
  // Each board column heads its tasks, with a Status column beside it.
  const text = (await readFile(await csv.path(), 'utf-8')).replace(String.fromCharCode(0xfeff), '')
  const lines = text.trim().split(String.fromCharCode(13, 10))
  expect(lines[0]).toBe('To Do,Status,In Progress,Status,Done,Status')
  expect(lines[1]).toBe("'=SUM(A1),Open,,,,")
  expect(lines[2]).toBe('Plain card,Open,,,,')

  const json = await menu('Download JSON')
  expect(json.suggestedFilename()).toBe('Export me.json')
  const data = JSON.parse(await readFile(await json.path(), 'utf-8'))
  expect(data.title).toBe('Export me')
  expect(data.columns[0].cards.map((c: { title: string }) => c.title)).toEqual(['=SUM(A1)', 'Plain card'])
})

test('T-711 T-712 list view in Arabic, right to left, dark, at phone width; no axe violations', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 780 }, colorScheme: 'dark' })
  await context.addInitScript(() => {
    localStorage.setItem('language', 'ar')
    localStorage.setItem('theme', 'dark')
  })
  const page = await context.newPage()
  await page.goto('/signin')
  await page.getByRole('button', { name: 'المتابعة كضيف' }).click()
  await openFirstBoard(page, 'إطلاق الموقع')
  await seedCards(page, [['تصميم الصفحة', 'كتابة الإعلان']])
  await page.getByRole('group', { name: 'طريقة العرض' }).getByRole('button', { name: 'قائمة' }).click()
  const table = page.getByRole('region', { name: 'بطاقات إطلاق الموقع' })
  await expect(table).toBeVisible()
  await expect(table.locator('tbody tr')).toHaveCount(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  expect(scan.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')}`))).toEqual([])
  await context.close()
})

test('T-713 the list stays fast with 100 cards', async ({ page }) => {
  await startAsGuest(page)
  await openBoard(page, 'Full board', [Array.from({ length: 96 }, (_, i) => `Card ${String(i).padStart(2, '0')}`), [], []])
  await page.getByRole('button', { name: 'List', exact: true }).click()
  const rows = page.getByRole('region', { name: 'Cards on Full board' }).locator('tbody tr')
  await expect(rows).toHaveCount(96)
  const ms = await page.evaluate(async () => {
    const header = [...document.querySelectorAll('th button')].find((b) => b.textContent === 'Title') as HTMLButtonElement
    const start = performance.now()
    header.click()
    header.click()
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    return performance.now() - start
  })
  await expect(rows.first()).toContainText('Card 95')
  expect(ms).toBeLessThan(200)
})
