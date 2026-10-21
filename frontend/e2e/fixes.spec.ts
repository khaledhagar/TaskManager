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

test('T-755 T-757 the board options button and the guest sign-up link say what they do', async ({ page }) => {
  await startAsGuest(page)
  await expect(page.getByRole('button', { name: 'Board options' })).toHaveText('Board options')
  await page.getByRole('button', { name: 'Sign up to save your boards' }).click()
  await expect(page.getByRole('dialog', { name: 'Sign up to save your boards' }).getByRole('button', { name: 'Create account' })).toBeVisible()
})
