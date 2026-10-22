import { expect, test, type Page } from '@playwright/test'
import { card, column, columnCards, DEMO, getBoard, openBoard, openExampleBoard, signUp } from './helpers.ts'

// New accounts start with empty columns (T-804); tests that need example cards open the example board.
let email = ''
test.beforeEach(async ({ page }) => {
  email = await signUp(page)
})

async function newBoard(page: Page, template: string, name: string) {
  await page.getByRole('button', { name: 'New board' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('radio', { name: new RegExp(`^${template}`) }).check()
  await dialog.getByLabel('Board name').fill(name)
  await dialog.getByRole('button', { name: 'Create board' }).click()
  await expect(page.getByRole('heading', { name })).toBeVisible()
}

/** Drag `from` onto `to` with small mouse steps (dnd-kit needs real movement). */
async function drag(page: Page, from: string | ReturnType<Page['locator']>, to: ReturnType<Page['locator']>, dy = 0) {
  const source = typeof from === 'string' ? page.getByText(from, { exact: true }) : from
  const a = (await source.boundingBox())!
  const b = (await to.boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 15; i++) {
    await page.mouse.move(a.x + a.width / 2 + ((b.x + b.width / 2 - a.x - a.width / 2) * i) / 15, a.y + a.height / 2 + ((b.y + b.height / 2 + dy - a.y - a.height / 2) * i) / 15)
  }
  await page.waitForTimeout(150)
  await page.mouse.up()
  await page.waitForTimeout(400)
}

test('T-303 a blank board has 3 columns; each template builds its board @smoke', async ({ page }) => {
  await newBoard(page, 'Blank', 'Plain board')
  await expect(page.getByRole('region')).toHaveCount(3)
  await newBoard(page, 'Sprint', 'Sprint 12')
  await expect(column(page, 'Review')).toBeVisible()
  await newBoard(page, 'Bug tracking', 'Bugs')
  await expect(column(page, 'Triaged')).toBeVisible()
  await newBoard(page, 'Personal', 'Home')
  await expect(column(page, 'This Week')).toBeVisible()
})

test('T-304 rename, add, reorder and delete columns; undo a column delete', async ({ page }) => {
  const id = await openBoard(page, 'Columns')
  await page.getByTitle('Rename column To Do').click()
  await page.keyboard.press('Control+A')
  await page.keyboard.type('Ideas')
  await page.keyboard.press('Enter')
  await expect(column(page, 'Ideas')).toBeVisible()
  await page.getByRole('button', { name: 'Add column' }).click()
  await page.getByLabel('Add column').fill('Blocked')
  await page.getByLabel('Add column').press('Enter')
  await expect(column(page, 'Blocked')).toBeVisible()
  await drag(page, page.getByRole('button', { name: 'Move column Blocked' }), page.getByRole('button', { name: 'Move column Ideas' }))
  await expect.poll(async () => (await getBoard(page, id)).columns.map((c) => c.title)).toEqual(['Blocked', 'Ideas', 'In Progress', 'Done'])
  await page.getByRole('button', { name: 'Column options: Done' }).click()
  await page.getByRole('menuitem', { name: 'Delete column' }).click()
  await expect(column(page, 'Done')).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(column(page, 'Done')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('region')).toHaveCount(4)
})

test('T-305 add a card, complete it, delete, undo, delete again and let it expire', async ({ page }) => {
  const id = await openBoard(page, 'Cards')
  await column(page, 'To Do').getByRole('button', { name: 'Add card' }).click()
  await page.getByLabel('New card title').fill('Write tests')
  await page.getByLabel('New card title').press('Enter')
  await page.keyboard.press('Escape')
  await page.getByRole('checkbox', { name: 'Completed: Write tests' }).click()
  await expect(page.getByRole('checkbox', { name: 'Completed: Write tests' })).toHaveAttribute('aria-checked', 'true')
  const deleteCard = async () => {
    await card(page, 'Write tests').click()
    await page.getByRole('button', { name: 'Delete card' }).click()
    await expect(page.getByText('Write tests', { exact: true })).toHaveCount(0)
  }
  await deleteCard()
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByText('Write tests', { exact: true })).toBeVisible()
  await deleteCard()
  await expect.poll(async () => (await getBoard(page, id)).columns[0].cards.length, { timeout: 10_000 }).toBe(0)
})

test('T-306 card window: markdown description, priority, due date, labels, checklist', async ({ page }) => {
  await openBoard(page, 'Details', [['Plan launch']])
  await card(page, 'Plan launch').click()
  const dialog = page.getByRole('dialog')
  await dialog.getByPlaceholder(/Add details/).fill('**Bold** and\n\n- one\n- two')
  await dialog.getByRole('button', { name: 'Save description' }).click()
  await dialog.getByRole('button', { name: 'Preview' }).click()
  await expect(dialog.locator('strong', { hasText: 'Bold' })).toBeVisible()
  await expect(dialog.getByRole('listitem').filter({ hasText: 'two' })).toBeVisible()
  await dialog.getByLabel('Priority').selectOption('urgent')
  await dialog.getByLabel('Due date').fill('2030-05-01')
  await dialog.getByLabel('New label name').fill('Launch')
  await dialog.getByRole('radio', { name: 'Green' }).click()
  await dialog.getByRole('button', { name: 'Add label' }).click()
  await expect(dialog.getByRole('checkbox', { name: 'Launch' })).toBeChecked()
  await dialog.getByLabel('Add an item').fill('Book venue')
  await dialog.getByLabel('Add an item').press('Enter')
  await dialog.getByLabel('Add an item').fill('Send invites')
  await dialog.getByLabel('Add an item').press('Enter')
  await dialog.getByRole('checkbox', { name: 'Book venue' }).check()
  await dialog.getByRole('button', { name: 'Delete item: Send invites' }).click()
  await page.keyboard.press('Escape')
  await page.reload()
  const tile = card(page, 'Plan launch')
  await expect(tile).toContainText('Urgent')
  await expect(tile).toContainText('Launch')
  await expect(tile).toContainText('1/1')
})

test('T-307 drag a card to another column and within a column; order persists @smoke', async ({ page }) => {
  const id = await openBoard(page, 'Drag', [['A1', 'A2', 'A3'], ['B1']])
  await drag(page, 'A1', page.getByText('A3', { exact: true }), 10)
  await drag(page, 'A2', page.getByText('B1', { exact: true }), -10)
  const expected = [['A3', 'A1'], ['A2', 'B1'], []]
  await expect.poll(() => columnCards(page)).toEqual(expected)
  await expect.poll(async () => (await getBoard(page, id)).columns.map((c) => c.cards.map((x) => x.title))).toEqual(expected)
  await page.reload()
  await expect.poll(() => columnCards(page)).toEqual(expected)
})

test('T-308 move a card with the keyboard only', async ({ page }) => {
  const id = await openBoard(page, 'Keys', [['K1'], []])
  await card(page, 'K1').focus()
  await page.keyboard.press('Space')
  await page.waitForTimeout(200)
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(200)
  await page.keyboard.press('Space')
  await expect.poll(async () => (await getBoard(page, id)).columns[1].cards.map((c) => c.title)).toEqual(['K1'])
})

test('T-309 search and each filter narrow the visible cards; clearing restores them', async ({ page }) => {
  await openExampleBoard(page, email)
  const cards = page.locator('li[class*=cardSlot]')
  await expect(cards).toHaveCount(7)
  await page.getByLabel('Search cards').fill('pricing')
  await expect(cards).toHaveCount(1)
  await page.getByRole('button', { name: 'Clear filters' }).first().click()
  await page.getByLabel('Filter by priority').selectOption('urgent')
  await expect(cards).toHaveCount(1)
  await page.getByLabel('Filter by priority').selectOption('')
  await page.getByLabel('Filter by status').selectOption('done')
  await expect(cards).toHaveCount(2)
  await page.getByLabel('Filter by status').selectOption('all')
  const label = await page.getByLabel('Filter by label').locator('option').nth(1).getAttribute('value')
  await page.getByLabel('Filter by label').selectOption(label!)
  expect(await cards.count()).toBeLessThan(7)
  await page.getByRole('button', { name: 'Clear filters' }).first().click()
  await expect(cards).toHaveCount(7)
})

test('T-310 overdue card is highlighted; progress updates when a card is completed', async ({ page }) => {
  await openExampleBoard(page, email)
  await expect(card(page, 'Fix checkout timeout').locator('[data-status=overdue]')).toBeVisible()
  await expect(page.getByText('2 of 7 done')).toBeVisible()
  await page.getByRole('checkbox', { name: 'Completed: Set up analytics' }).click()
  await expect(page.getByText('3 of 7 done')).toBeVisible()
})

test('T-311 keyboard shortcuts N, /, ? and Esc', async ({ page }) => {
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('n')
  await expect(page.getByLabel('New card title')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByLabel('New card title')).toHaveCount(0)
  await page.keyboard.press('/')
  await expect(page.getByLabel('Search cards')).toBeFocused()
  await page.keyboard.press('Escape')
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('?')
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('T-312 dark mode persists across reload @smoke', async ({ page }) => {
  await page.getByRole('button', { name: 'Switch to dark theme' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.getByRole('heading', { name: DEMO })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})
