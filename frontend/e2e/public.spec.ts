import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { card, column } from './helpers.ts'
import { openMembers, person, share } from './sharingHelpers.ts'

// Each test signs up two or three people in separate browsers; WebKit needs longer under load.
test.describe.configure({ timeout: 120_000 })

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']

test('T-578 admin makes a board public; a signed-out visitor sees it read-only; a signed-in user joins @smoke', async ({ browser }) => {
  const alice = await person(browser, 'alice')
  const bob = await person(browser, 'bob')
  await share(alice.page, bob.page, bob.email)
  const panel = await openMembers(alice.page)
  await panel.getByRole('checkbox', { name: 'Anyone with the link can view' }).check()
  const link = await panel.getByLabel('Public board link').inputValue()
  expect(link).toMatch(/\/p\/[\w-]{32,}$/)
  const path = new URL(link).pathname

  const visitor = await (await browser.newContext()).newPage()
  await visitor.goto(path)
  await expect(visitor.getByRole('heading', { name: 'Team plan' })).toBeVisible()
  await expect(visitor.getByText('View only')).toBeVisible()
  await expect(column(visitor, 'To Do')).toContainText('Write announcement')
  await expect(visitor.getByRole('checkbox')).toHaveCount(0)
  await expect(visitor.getByRole('button', { name: /Add card/ })).toHaveCount(0)

  const carol = await person(browser, 'carol')
  await carol.page.goto(path)
  await carol.page.getByRole('button', { name: 'Join board' }).click()
  await expect(carol.page.getByRole('heading', { name: 'Team plan' })).toBeVisible()
  await carol.page.getByRole('checkbox', { name: 'Completed: Write announcement' }).click()
  await expect(carol.page.getByText('You can only view this board. Ask the board admin for permission to edit.')).toBeVisible()

  await panel.getByRole('checkbox', { name: 'Anyone with the link can view' }).uncheck()
  await visitor.reload()
  await expect(visitor.getByRole('alert')).toContainText('This board is not public')
})

test('T-579 admin assigns a card; the member filters "Assigned to me" and sees it', async ({ browser }) => {
  const alice = await person(browser, 'alice')
  const bob = await person(browser, 'bob')
  await share(alice.page, bob.page, bob.email)
  await alice.page.reload()
  await card(alice.page, 'Fix checkout').click()
  const dialog = alice.page.getByRole('dialog', { name: 'Fix checkout' })
  await dialog.getByRole('group', { name: 'Assigned to' }).getByRole('checkbox', { name: new RegExp(bob.email.replace(/\./g, '\\.')) }).check()
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(card(alice.page, 'Fix checkout')).toContainText(`Assigned to ${bob.email}`)
  await bob.page.reload()
  await bob.page.getByLabel('Filter by status').selectOption({ label: 'Assigned to me' })
  await expect(card(bob.page, 'Fix checkout')).toBeVisible()
  await expect(card(bob.page, 'Write announcement')).toHaveCount(0)
})

test('T-580 admin saves a Zoom link; members see Start meeting; Email the link to members', async ({ browser, request }) => {
  const alice = await person(browser, 'alice')
  const bob = await person(browser, 'bob')
  await share(alice.page, bob.page, bob.email)
  const zoom = 'https://us05web.zoom.us/j/123456789'
  const panel = await openMembers(alice.page)
  await panel.getByLabel('Meeting link (Zoom, Google Meet, Teams)').fill(zoom)
  await panel.getByRole('button', { name: 'Save link' }).click()
  await panel.getByRole('button', { name: 'Email the link to members' }).click()
  await expect(panel.getByText('The meeting link was emailed to the members.')).toBeVisible()
  await expect(async () => {
    const mail = await (await request.get(`/__e2e/outbox?to=${encodeURIComponent(bob.email)}`)).json()
    expect(mail.subject).toBe('Meeting for Team plan')
    expect(mail.text).toContain(zoom)
  }).toPass()
  await bob.page.reload()
  const start = bob.page.getByRole('link', { name: 'Start meeting' })
  await expect(start).toHaveAttribute('href', zoom)
  await expect(start).toHaveAttribute('rel', 'noopener noreferrer')
})

test('T-581 T-582 public page, share panel and assignee picker: phone, dark, Arabic, no axe violations', async ({ browser }) => {
  const alice = await person(browser, 'alice')
  const bob = await person(browser, 'bob')
  await share(alice.page, bob.page, bob.email)
  const panel = await openMembers(alice.page)
  await panel.getByRole('checkbox', { name: 'Anyone with the link can view' }).check()
  const path = new URL(await panel.getByLabel('Public board link').inputValue()).pathname
  const context = await browser.newContext({
    viewport: { width: 360, height: 780 },
    colorScheme: 'dark',
    storageState: await alice.page.context().storageState(),
  })
  await context.addInitScript(() => {
    localStorage.setItem('language', 'ar')
    localStorage.setItem('theme', 'dark')
  })
  const phone = await context.newPage()
  const fits = () => phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
  const scan = async () =>
    (await new AxeBuilder({ page: phone }).withTags(TAGS).analyze()).violations.flatMap((v) =>
      v.nodes.map((n) => `${v.id}: ${n.target.join(' ')} ${n.failureSummary}`),
    )

  await phone.goto(alice.page.url())
  await phone.getByRole('button', { name: 'خيارات اللوحة' }).click()
  await phone.getByRole('menuitem', { name: 'الأعضاء' }).click()
  await expect(phone.getByRole('checkbox', { name: 'يمكن لأي شخص لديه الرابط العرض' })).toBeChecked()
  expect(await fits()).toBe(true)
  expect(await scan()).toEqual([])
  await phone.getByRole('button', { name: 'إغلاق' }).click()

  await card(phone, 'Fix checkout').click()
  await expect(phone.getByRole('group', { name: 'مسندة إلى' })).toBeVisible()
  expect(await fits()).toBe(true)
  expect(await scan()).toEqual([])

  await phone.goto(path)
  await expect(phone.getByText('للعرض فقط')).toBeVisible()
  await expect(phone.locator('html')).toHaveAttribute('dir', 'rtl')
  expect(await fits()).toBe(true)
  expect(await scan()).toEqual([])
})
