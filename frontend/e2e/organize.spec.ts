import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { drag } from './sharingHelpers.ts'
import { card, column, openBoard, seedCards, startAsGuest } from './helpers.ts'

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']

async function violations(page: Page) {
  const scan = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  return scan.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')}`))
}

async function boardMenu(page: Page, item: string, options = 'Board options') {
  await page.getByRole('button', { name: options }).click()
  await page.getByRole('menuitem', { name: item }).click()
}

test('T-690 archive a card and restore it @smoke', async ({ page }) => {
  await startAsGuest(page)
  await openBoard(page, 'Archive test', [['Keep me', 'Old card'], [], []])
  await card(page, 'Old card').click()
  await page.getByRole('button', { name: 'Archive', exact: true }).click()
  await expect(card(page, 'Old card')).toHaveCount(0)
  await expect(page.getByText('Card archived')).toBeVisible()

  await boardMenu(page, 'Archived cards and columns')
  const panel = page.getByRole('dialog', { name: 'Archived cards and columns' })
  await expect(panel.getByText('From To Do')).toBeVisible()
  await panel.getByRole('button', { name: 'Restore Old card' }).click()
  await expect(panel.getByText(/Nothing is archived/)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(column(page, 'To Do').getByRole('button', { name: /^Old card/ })).toBeVisible()
})

test('T-691 duplicate a board and create a board from a saved template', async ({ page }) => {
  await startAsGuest(page)
  await openBoard(page, 'Original', [['Plan', 'Build'], ['Test'], []])
  await boardMenu(page, 'Duplicate board')
  await expect(page.getByRole('heading', { name: 'Original (copy)' })).toBeVisible()
  await expect(card(page, 'Build')).toBeVisible()

  await boardMenu(page, 'Save as template')
  const dialog = page.getByRole('dialog', { name: 'Save as template' })
  await dialog.getByLabel('Template name').fill('Release kit')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Saved as template "Release kit"')).toBeVisible()

  await page.getByRole('button', { name: 'New board' }).click()
  await page.getByRole('radio', { name: 'Release kit' }).check()
  await page.getByRole('button', { name: 'Create board' }).click()
  await expect(page.getByRole('heading', { name: 'Release kit' })).toBeVisible()
  await expect(column(page, 'In Progress').getByRole('button', { name: /^Test/ })).toBeVisible()
})

test('T-692 WIP warning and auto-complete in the browser', async ({ page }) => {
  await startAsGuest(page)
  await openBoard(page, 'Flow', [['One', 'Two'], [], []])
  await boardMenu(page, 'Set WIP limit', 'Column options: To Do')
  const dialog = page.getByRole('dialog', { name: 'Work in progress limit' })
  await dialog.getByLabel('Most cards in "To Do"').fill('1')
  await dialog.getByRole('button', { name: 'Save' }).click()
  const count = page.getByLabel('2 cards, over the limit of 1')
  await expect(count).toHaveText('2 of 1')
  await expect(count).toHaveAttribute('data-over', 'true')

  await boardMenu(page, 'Auto-complete: off')
  await expect(page.getByText(/now marked complete/)).toBeVisible()
  await drag(page, 'One', 'Done')
  // The drag overlay leaves after its drop animation.
  await expect(page.getByRole('checkbox', { name: 'Completed: One' })).toHaveCount(1)
  await expect(page.getByRole('checkbox', { name: 'Completed: One' })).toBeChecked()
  await page.reload()
  await expect(page.getByRole('checkbox', { name: 'Completed: One' })).toBeChecked()
  await expect(column(page, 'To Do').getByLabel('1 card')).toHaveText('1 of 1')
})

test('T-698 point the focus timer at a card; a finished period shows on the card', async ({ page }) => {
  await page.clock.install()
  await startAsGuest(page)
  await openBoard(page, 'Focus', [['Write report'], [], []])
  await page.getByRole('button', { name: 'Focus timer' }).click()
  const panel = page.getByRole('dialog', { name: 'Focus timer' })
  await panel.getByLabel('Focus on a card').selectOption({ label: 'Write report' })
  await panel.getByRole('button', { name: 'Start focus' }).click()
  await page.clock.runFor('25:01')
  await expect(page.getByText('Focus session saved on "Write report"')).toBeVisible()
  await expect(card(page, 'Write report')).toContainText('1 focus session, 25 min')
})

test('T-693 T-694 new panels in Arabic, right to left, dark, at phone width; no axe violations', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 780 }, colorScheme: 'dark' })
  await context.addInitScript(() => {
    localStorage.setItem('language', 'ar')
    localStorage.setItem('theme', 'dark')
  })
  const page = await context.newPage()
  await page.goto('/signin')
  await page.getByRole('button', { name: 'المتابعة كضيف' }).click()
  await expect(page.getByRole('heading', { name: 'إطلاق الموقع' })).toBeVisible()
  // Guests start with empty columns: two cards make the WIP limit of 1 show its warning.
  await seedCards(page, [[], ['تصميم الصفحة', 'بناء الواجهة']])
  expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl')
  const found: string[] = []

  await boardMenu(page, 'البطاقات والأعمدة المؤرشفة', 'خيارات اللوحة')
  await expect(page.getByRole('dialog', { name: 'البطاقات والأعمدة المؤرشفة' })).toBeVisible()
  found.push(...(await violations(page)))
  await page.keyboard.press('Escape')

  await boardMenu(page, 'حفظ كقالب', 'خيارات اللوحة')
  await expect(page.getByRole('dialog', { name: 'حفظ كقالب' })).toBeVisible()
  found.push(...(await violations(page)))
  await page.keyboard.press('Escape')

  await boardMenu(page, 'تحديد حد العمل الجاري', 'خيارات العمود: قيد التنفيذ')
  const wip = page.getByRole('dialog', { name: 'حد العمل الجاري' })
  await wip.getByRole('spinbutton').fill('1')
  await wip.getByRole('button', { name: 'حفظ' }).click()
  await expect(page.locator('[data-over]')).toBeVisible()
  await page.getByRole('button', { name: 'تمييز اللوحة بنجمة' }).click()
  await expect(page.getByRole('button', { name: 'تمييز اللوحة بنجمة' })).toHaveAttribute('aria-pressed', 'true')
  found.push(...(await violations(page)))
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(found).toEqual([])
  await context.close()
})
