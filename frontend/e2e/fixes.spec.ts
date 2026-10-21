import { expect, test, type Page } from '@playwright/test'
import { card, column, getBoard, openBoard, startAsGuest } from './helpers.ts'

/** Speech recognition that always fails as if the microphone were blocked. */
async function blockedMicrophone(page: Page) {
  await page.addInitScript(() => {
    class Blocked {
      lang = ''
      interimResults = false
      continuous = false
      onresult = null
      onerror: ((e: { error: string }) => void) | null = null
      onend: (() => void) | null = null
      start() {
        setTimeout(() => {
          this.onerror?.({ error: 'not-allowed' })
          this.onend?.()
        }, 50)
      }
      stop() {}
      abort() {}
    }
    Object.assign(window, { SpeechRecognition: Blocked, webkitSpeechRecognition: Blocked })
  })
}

const columnTitles = async (page: Page, id: number) => (await getBoard(page, id)).columns.map((c) => c.title)

test('T-751 a blocked microphone explains itself inside the card window, and the message can be closed @smoke', async ({ page }) => {
  await blockedMicrophone(page)
  await startAsGuest(page)
  await openBoard(page, 'Voice', [['Plan'], [], []])
  await card(page, 'Plan').click()
  const dialog = page.getByRole('dialog', { name: 'Plan' })
  for (let i = 0; i < 2; i++) {
    await dialog.getByRole('button', { name: 'Start voice input' }).first().click()
    const message = dialog.getByText(/The microphone is blocked for this site/)
    await expect(message).toBeVisible()
    await message.locator('..').getByRole('button', { name: 'Dismiss' }).click()
    await expect(message).toHaveCount(0)
  }
  await expect(dialog).toBeVisible()
})

test('T-752 a column moves with Move left and Move right; the order is saved', async ({ page }) => {
  await startAsGuest(page)
  const id = await openBoard(page, 'Order')
  await page.getByRole('button', { name: 'Column options: To Do' }).click()
  await page.getByRole('menuitem', { name: 'Move right' }).click()
  await expect.poll(() => columnTitles(page, id)).toEqual(['In Progress', 'To Do', 'Done'])
  await page.getByRole('button', { name: 'Column options: Done' }).click()
  await page.getByRole('menuitem', { name: 'Move left' }).click()
  await expect.poll(() => columnTitles(page, id)).toEqual(['In Progress', 'Done', 'To Do'])
  await page.reload()
  await expect(column(page, 'To Do')).toBeVisible()
  const shown = await page.locator('section[aria-label]').evaluateAll((s) => s.map((e) => e.getAttribute('aria-label')))
  expect(shown.filter((n) => ['To Do', 'In Progress', 'Done'].includes(n ?? ''))).toEqual(['In Progress', 'Done', 'To Do'])
})

test('T-754 archive a column with its cards and restore it from the Archived panel', async ({ page }) => {
  await startAsGuest(page)
  const id = await openBoard(page, 'Columns', [['A1', 'A2'], ['B1'], []])
  await page.getByRole('button', { name: 'Column options: To Do' }).click()
  await page.getByRole('menuitem', { name: 'Archive column' }).click()
  await expect(column(page, 'To Do')).toHaveCount(0)
  await expect.poll(() => columnTitles(page, id)).toEqual(['In Progress', 'Done'])
  await page.getByRole('button', { name: 'Board options' }).click()
  await page.getByRole('menuitem', { name: 'Archived cards and columns' }).click()
  const panel = page.getByRole('dialog', { name: 'Archived cards and columns' })
  await expect(panel.getByText('2 cards')).toBeVisible()
  await panel.getByRole('button', { name: 'Restore column To Do' }).click()
  await expect(panel.getByText(/Nothing is archived/)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(column(page, 'To Do').getByRole('button', { name: /^A2/ })).toBeVisible()
  expect(await columnTitles(page, id)).toEqual(['In Progress', 'Done', 'To Do'])
})

test('T-755 T-757 bold "..." board options, a Share button, and the guest sign-up link', async ({ page }) => {
  await startAsGuest(page)
  await expect(page.getByRole('button', { name: 'Board options' })).toHaveText('')
  await page.getByRole('button', { name: 'Share' }).click()
  await expect(page.getByRole('dialog', { name: /^Members of/ })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Sign up to save your boards' }).click()
  await expect(page.getByRole('dialog', { name: 'Sign up to save your boards' }).getByRole('button', { name: 'Create account' })).toBeVisible()
})

/** Press on `from`, move in small steps to (x, y), release: dnd-kit needs real movement. */
async function dragTo(page: Page, from: ReturnType<Page['locator']>, x: number, y: number) {
  const a = (await from.boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 20; i++) await page.mouse.move(a.x + a.width / 2 + ((x - a.x - a.width / 2) * i) / 20, a.y + a.height / 2 + ((y - a.y - a.height / 2) * i) / 20)
  await page.waitForTimeout(200)
  await page.mouse.up()
}

test('T-770 a column is dragged by its header, on a laptop and on a phone where columns stack', async ({ page }) => {
  await startAsGuest(page)
  const id = await openBoard(page, 'Drag me')
  const head = (title: string) => page.getByRole('region', { name: title, exact: true }).getByRole('heading')
  const done = (await page.getByRole('region', { name: 'Done', exact: true }).boundingBox())!
  await dragTo(page, head('To Do'), done.x + done.width / 2, done.y + 20)
  await expect.poll(() => columnTitles(page, id)).toEqual(['In Progress', 'Done', 'To Do'])

  await page.setViewportSize({ width: 390, height: 900 })
  const first = (await page.getByRole('region', { name: 'In Progress', exact: true }).boundingBox())!
  const last = (await page.getByRole('region', { name: 'To Do', exact: true }).boundingBox())!
  expect(last.y).toBeGreaterThan(first.y + first.height - 1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await dragTo(page, head('To Do'), last.x + last.width / 2, first.y + 10)
  await expect.poll(() => columnTitles(page, id)).toEqual(['To Do', 'In Progress', 'Done'])
  // A click on the title still renames the column.
  await page.getByRole('region', { name: 'Done', exact: true }).getByRole('button', { name: 'Done', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Rename column Done' })).toBeVisible()
})

test('T-769 a board is deleted from its tile on the start page', async ({ page }) => {
  await startAsGuest(page)
  await openBoard(page, 'Old plans')
  await page.getByRole('button', { name: 'All boards' }).click()
  const main = page.getByRole('region', { name: 'Your work' })
  await main.getByRole('button', { name: 'Board options: Old plans' }).click()
  await page.getByRole('menuitem', { name: 'Delete board' }).click()
  await page.getByRole('dialog', { name: 'Delete this board?' }).getByRole('button', { name: 'Delete board' }).click()
  await expect(main.getByRole('link', { name: /^Old plans/ })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('region', { name: 'Your work' }).getByRole('link', { name: /^Old plans/ })).toHaveCount(0)
})
