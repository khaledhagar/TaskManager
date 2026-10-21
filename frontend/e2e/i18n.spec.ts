import { expect, test, type Page } from '@playwright/test'
import { columnCards, getBoard, newEmail, openBoard, PASSWORD, signUp, startAsGuest } from './helpers.ts'

const toArabic = (page: Page) => page.getByRole('button', { name: 'العربية' }).click()

test('T-327 Arabic: right-to-left, Arabic texts, kept after reload and on sign-in @smoke', async ({ page, browser }) => {
  const email = await signUp(page)
  await toArabic(page)
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  await expect(page.getByRole('banner').getByRole('button', { name: 'لوحة جديدة' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'English' })).toBeVisible()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByRole('banner').getByRole('button', { name: 'لوحة جديدة' })).toBeVisible()

  // A fresh browser takes the language saved on the account when signing in.
  const other = await (await browser.newContext()).newPage()
  await other.goto('/signin')
  await expect(other.locator('html')).toHaveAttribute('dir', 'ltr')
  await other.getByLabel('Email').fill(email)
  await other.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await other.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(other.getByRole('heading', { name: 'عملك', level: 1 })).toBeVisible()
  await expect(other.locator('html')).toHaveAttribute('dir', 'rtl')
})

test('T-328 in Arabic, drag a card and reorder columns with the mouse and the keyboard', async ({ page }) => {
  await startAsGuest(page)
  await toArabic(page)
  const id = await openBoard(page, 'RTL', [['C1', 'C2'], ['D1']])
  const titles = async () => (await getBoard(page, id)).columns.map((c) => c.title)
  const firstColumn = (await titles())[0]

  // Mouse: drag C1 onto D1 (the second column is to the left in RTL).
  const a = (await page.getByText('C1', { exact: true }).boundingBox())!
  const b = (await page.getByText('D1', { exact: true }).boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 15; i++) await page.mouse.move(a.x + a.width / 2 + ((b.x - a.x) * i) / 15, a.y + a.height / 2 + ((b.y - 8 - a.y) * i) / 15)
  await page.waitForTimeout(150)
  await page.mouse.up()
  await expect.poll(() => columnCards(page)).toEqual([['C2'], ['C1', 'D1'], []])

  // Keyboard: in RTL, ArrowLeft moves toward the next column.
  await page.getByRole('button', { name: /^C2/ }).focus()
  await page.keyboard.press('Space')
  await page.waitForTimeout(200)
  await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(200)
  await page.keyboard.press('Space')
  await expect.poll(async () => (await getBoard(page, id)).columns[1].cards.length).toBe(3)

  // Keyboard: move the first column one place toward the end.
  await page.getByRole('button', { name: `نقل العمود ${firstColumn}` }).focus()
  await page.keyboard.press('Space')
  await page.waitForTimeout(200)
  await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(200)
  await page.keyboard.press('Space')
  await expect.poll(async () => (await titles())[1]).toBe(firstColumn)
})

test('T-327 emails follow the language of the page', async ({ page }) => {
  const email = newEmail('arabic')
  await page.goto('/signin')
  await toArabic(page)
  await page.getByRole('link', { name: 'أنشئ حسابا' }).click()
  await page.getByLabel('البريد الإلكتروني').fill(email)
  await page.getByLabel('كلمة المرور', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'إنشاء الحساب' }).click()
  await expect(page.getByRole('heading', { name: 'تحقق من بريدك' })).toBeVisible()
  const mail = await (await page.request.get(`/__e2e/outbox?to=${encodeURIComponent(email)}`)).json()
  expect(mail.subject).toMatch(/[\u0600-\u06FF]/)
  expect(mail.text).toMatch(/[\u0600-\u06FF]/)
})
