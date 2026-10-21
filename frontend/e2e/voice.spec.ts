import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { column, getBoard, openBoard, startAsGuest } from './helpers.ts'

/**
 * Replace the browser's speech recognition with a fake that "hears" `window.__words` a moment
 * after starting. It records the language it was asked for in `window.__speechLang`.
 */
async function fakeSpeech(page: Page) {
  await page.addInitScript(() => {
    type Handler = ((event: unknown) => void) | null
    class FakeRecognition {
      lang = ''
      interimResults = false
      continuous = false
      onresult: Handler = null
      onerror: Handler = null
      onend: (() => void) | null = null
      start() {
        const w = window as unknown as { __words?: string; __speechLang?: string }
        w.__speechLang = this.lang
        setTimeout(() => {
          const result = Object.assign([{ transcript: w.__words ?? '' }], { isFinal: true })
          this.onresult?.({ resultIndex: 0, results: [result] })
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

const say = (page: Page, words: string) => page.evaluate((w) => Object.assign(window, { __words: w }), words)

test('T-610 speak a card title into the composer, press Enter, the card is added @smoke', async ({ page }) => {
  await fakeSpeech(page)
  await startAsGuest(page)
  await openBoard(page, 'Spoken plans')
  await column(page, 'To Do').getByRole('button', { name: 'Add card' }).click()
  await say(page, 'Call the supplier')
  await column(page, 'To Do').getByRole('button', { name: 'Start voice input' }).click()
  const field = page.getByLabel('New card title')
  await expect(field).toHaveValue('Call the supplier')
  await field.press('Enter')
  await expect(column(page, 'To Do')).toContainText('Call the supplier')
})

test('T-611 speak a request into the AI chat; confirming adds the card', async ({ page }) => {
  await fakeSpeech(page)
  await startAsGuest(page)
  const id = await openBoard(page, 'Voice and AI')
  const board = await getBoard(page, id)
  await page.route('**/api/ai/chat', (route) =>
    route.fulfill({
      json: {
        reply: 'I can add it.',
        actions: [{ type: 'create_card', card_id: null, column_id: board.columns[1].id, title: 'Call the supplier' }],
      },
    }),
  )
  await page.getByRole('button', { name: 'Ask AI' }).click()
  const panel = page.getByRole('complementary', { name: 'AI assistant' }).or(page.getByRole('dialog', { name: 'AI assistant' }))
  await say(page, 'add a card Call the supplier to In Progress')
  await panel.getByRole('button', { name: 'Start voice input' }).click()
  await expect(panel.getByLabel('Message')).toHaveValue('add a card Call the supplier to In Progress')
  await panel.getByRole('button', { name: 'Send' }).click()
  await panel.getByRole('button', { name: /^Confirm: / }).click()
  await expect(column(page, 'In Progress')).toContainText('Call the supplier')
})

test('T-612 Arabic speech uses ar-EG and fills the field right to left', async ({ page }) => {
  await fakeSpeech(page)
  await page.addInitScript(() => localStorage.setItem('language', 'ar'))
  await page.goto('/')
  await page.getByRole('button', { name: 'المتابعة كضيف' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await say(page, 'إطلاق الموقع')
  await page.getByRole('button', { name: 'بدء الإدخال الصوتي' }).first().click()
  const search = page.getByRole('searchbox')
  await expect(search).toHaveValue('إطلاق الموقع')
  await expect(search).toHaveAttribute('dir', 'auto')
  expect(await page.evaluate(() => (window as unknown as { __speechLang: string }).__speechLang)).toBe('ar-EG')
  expect(await search.evaluate((el) => getComputedStyle(el).direction)).toBe('rtl')
})

test('T-613 microphone buttons at phone width, dark, Arabic; no axe violations', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 780 }, colorScheme: 'dark', hasTouch: true })
  await context.addInitScript(() => {
    localStorage.setItem('language', 'ar')
    localStorage.setItem('theme', 'dark')
  })
  const page = await context.newPage()
  await fakeSpeech(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'المتابعة كضيف' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const mic = page.getByRole('button', { name: 'بدء الإدخال الصوتي' }).first()
  await expect(mic).toBeVisible()
  const box = (await mic.boundingBox())!
  expect(box.width).toBeGreaterThanOrEqual(40)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  expect(scan.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')}`))).toEqual([])
})
