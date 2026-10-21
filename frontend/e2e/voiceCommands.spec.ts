import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { api, card, column, getBoard, openBoard, startAsGuest } from './helpers.ts'

/** Speech recognition that "hears" `window.__words` a moment after it starts. */
async function fakeSpeech(page: Page) {
  await page.addInitScript(() => {
    class FakeRecognition {
      lang = ''
      interimResults = false
      continuous = false
      onresult: ((e: unknown) => void) | null = null
      onerror: ((e: unknown) => void) | null = null
      onend: (() => void) | null = null
      start() {
        setTimeout(() => {
          const words = (window as unknown as { __words?: string }).__words ?? ''
          this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: words }], { isFinal: true })] })
          this.onend?.()
        }, 100)
      }
      stop() {
        this.onend?.()
      }
      abort() {}
    }
    Object.assign(window, { SpeechRecognition: FakeRecognition, webkitSpeechRecognition: FakeRecognition })
  })
}

/** Press V (the shortcut) after setting what the fake microphone will hear. */
async function command(page: Page, words: string) {
  await page.evaluate((w) => Object.assign(window, { __words: w }), words)
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('v')
  return page.getByRole('dialog', { name: /^(Voice command|أمر صوتي)$/ })
}

test.beforeEach(async ({ page }) => {
  await fakeSpeech(page)
  await startAsGuest(page)
})

test('T-789 add a card by voice and confirm; it is saved @smoke', async ({ page }) => {
  const id = await openBoard(page, 'Voice')
  const dialog = await command(page, 'add card Buy domain to Done')
  await expect(dialog.getByText('Add card "Buy domain" to Done')).toBeVisible()
  await dialog.getByRole('button', { name: 'Confirm' }).click()
  await expect(column(page, 'Done').getByRole('button', { name: /^Buy domain/ })).toBeVisible()
  await expect.poll(async () => (await getBoard(page, id)).columns[2].cards.map((c) => c.title)).toEqual(['Buy domain'])
})

test('T-790 move and complete by voice; search and "show overdue" filter the board', async ({ page }) => {
  const id = await openBoard(page, 'Voice', [['Buy domain', 'Write post'], [], []])
  let dialog = await command(page, 'move buy domain to done')
  await dialog.getByRole('button', { name: 'Confirm' }).click()
  await expect(column(page, 'Done').getByRole('button', { name: /^Buy domain/ })).toBeVisible()
  dialog = await command(page, 'complete write post')
  await dialog.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByRole('checkbox', { name: 'Completed: Write post' })).toBeChecked()
  const done = async () => (await api<{ columns: { cards: { completed: boolean }[] }[] }>(page, 'GET', `/api/boards/${id}`)).columns[0].cards[0].completed
  await expect.poll(done).toBe(true)

  await command(page, 'search domain')
  await expect(page.getByRole('searchbox')).toHaveValue('domain')
  await expect(card(page, 'Write post')).toHaveCount(0)
  await command(page, 'clear filters')
  await expect(card(page, 'Write post')).toBeVisible()
  await command(page, 'show overdue')
  await expect(page.getByLabel('Filter by status')).toHaveValue('overdue')
})

test('T-791 an unclear name offers a choice; a phrase it does not understand goes to the AI', async ({ page }) => {
  await openBoard(page, 'Voice', [['Design page', 'Design logo'], [], []])
  await page.route('**/api/ai/chat', (route) => route.fulfill({ json: { reply: 'Nothing is due this week.', actions: [] } }))
  const dialog = await command(page, 'move design to done')
  await dialog.getByRole('group', { name: 'Which one did you mean?' }).getByRole('button', { name: 'Design logo' }).click()
  await dialog.getByRole('button', { name: 'Confirm' }).click()
  await expect(column(page, 'Done').getByRole('button', { name: /^Design logo/ })).toBeVisible()

  await command(page, 'what is due this week')
  const chat = page.getByRole('complementary', { name: 'AI assistant' })
  await expect(chat.getByText('what is due this week')).toBeVisible()
  await expect(chat.getByText('Nothing is due this week.')).toBeVisible()
})

test('T-792 T-793 Arabic, right to left, dark, phone width; no axe violations; keyboard only', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.evaluate(() => {
    localStorage.setItem('language', 'ar')
    localStorage.setItem('theme', 'dark')
  })
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  // Boards made through the API in tests have English column names.
  await openBoard(page, 'صوت')
  const dialog = await command(page, 'أضف بطاقة شراء النطاق إلى Done')
  await expect(dialog.getByText('إضافة البطاقة "شراء النطاق" إلى Done')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  expect(scan.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')}`))).toEqual([])
  // Confirm has the focus, so Enter confirms; Escape would close.
  await expect(dialog.getByRole('button', { name: 'تأكيد' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(column(page, 'Done').getByRole('button', { name: /^شراء النطاق/ })).toBeVisible()
  const again = await command(page, 'ماذا يمكنني أن أقول')
  await expect(again.getByText('انقل شراء النطاق إلى تم')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(again).toHaveCount(0)
})
