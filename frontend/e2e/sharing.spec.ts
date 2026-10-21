import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Browser, type Page } from '@playwright/test'
import { card, column, newEmail, openBoard, signUp } from './helpers.ts'

const VIEW_ONLY = 'You can only view this board. Ask the board admin for permission to edit.'

/** A fresh signed-up user in their own browser context. */
async function person(browser: Browser, tag: string) {
  const page = await (await browser.newContext()).newPage()
  const email = await signUp(page, newEmail(tag))
  return { page, email }
}

async function openMembers(page: Page) {
  await page.getByRole('button', { name: 'Board options' }).click()
  await page.getByRole('menuitem', { name: 'Members' }).click()
  return page.getByRole('dialog', { name: /^Members of/ })
}

/** Admin invites the member by email; the member opens the link and accepts. Returns the board id. */
async function share(admin: Page, member: Page, memberEmail: string, cards = [['Write announcement', 'Fix checkout']]) {
  const id = await openBoard(admin, 'Team plan', [...cards, [], []].slice(0, 3))
  const panel = await openMembers(admin)
  await panel.getByLabel('Invite by email').fill(memberEmail)
  await panel.getByRole('button', { name: 'Invite' }).click()
  const link = await panel.getByLabel('Invitation link').inputValue()
  await expect(panel.getByRole('link', { name: 'Share on WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\//)
  await panel.getByRole('button', { name: 'Close' }).click()
  await member.goto(new URL(link).pathname + new URL(link).hash)
  await expect(member.getByText(/invited you to join "Team plan"/)).toBeVisible()
  await member.getByRole('button', { name: 'Accept invitation' }).click()
  await expect(member.getByRole('heading', { name: 'Team plan' })).toBeVisible()
  return id
}

async function setRole(admin: Page, memberEmail: string, role: string) {
  const panel = await openMembers(admin)
  const radio = panel.getByRole('group', { name: `Permission for ${memberEmail}` }).getByRole('radio', { name: role })
  await radio.check()
  await expect(radio).toBeChecked()
  await panel.getByRole('button', { name: 'Close' }).click()
}

async function drag(page: Page, from: string, to: string) {
  const a = (await card(page, from).boundingBox())!
  const b = (await column(page, to).boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 15; i++) {
    await page.mouse.move(a.x + a.width / 2 + ((b.x + b.width / 2 - a.x - a.width / 2) * i) / 15, a.y + a.height / 2 + ((b.y + 80 - a.y - a.height / 2) * i) / 15)
  }
  await page.waitForTimeout(150)
  await page.mouse.up()
}

test('T-553 admin invites a member, who accepts and sees the board as Viewer @smoke', async ({ browser }) => {
  const alice = await person(browser, 'alice')
  const bob = await person(browser, 'bob')
  await share(alice.page, bob.page, bob.email)
  const panel = await openMembers(bob.page)
  await expect(panel.getByText('Your permission: Viewer')).toBeVisible()
  await expect(panel.getByText(alice.email)).toBeVisible()
  await panel.getByRole('button', { name: 'Close' }).click()
  await bob.page.getByRole('button', { name: /switch board/ }).click()
  await expect(bob.page.getByRole('menu')).toContainText('Shared with you')
})

test('T-554 viewer drag is refused; Request access reaches the admin, who allows full access', async ({ browser, request }) => {
  const alice = await person(browser, 'alice')
  const bob = await person(browser, 'bob')
  await share(alice.page, bob.page, bob.email)
  await drag(bob.page, 'Write announcement', 'Done')
  await expect(bob.page.getByText(VIEW_ONLY)).toBeVisible()
  await expect(column(bob.page, 'To Do')).toContainText('Write announcement')
  await bob.page.getByRole('button', { name: 'Request access' }).click()
  await expect(bob.page.getByText('Request sent. The board admin will get an email.')).toBeVisible()
  await expect(async () => {
    const mail = await (await request.get(`/__e2e/outbox?to=${encodeURIComponent(alice.email)}`)).json()
    expect(mail.subject).toContain('asks for more access')
  }).toPass()
  const panel = await openMembers(alice.page)
  await panel.getByRole('button', { name: 'Allow: Full access' }).click()
  await expect(panel.getByRole('group', { name: `Permission for ${bob.email}` }).getByRole('radio', { name: 'Full access' })).toBeChecked()
  await bob.page.reload()
  await column(bob.page, 'Done').getByRole('button', { name: 'Add card' }).click()
  await bob.page.getByLabel('New card title').fill('Added by Bob')
  await bob.page.getByLabel('New card title').press('Enter')
  await expect(column(bob.page, 'Done')).toContainText('Added by Bob')
})

test('T-555 "Can update tasks" moves and completes but cannot delete', async ({ browser }) => {
  const alice = await person(browser, 'alice')
  const bob = await person(browser, 'bob')
  await share(alice.page, bob.page, bob.email)
  await setRole(alice.page, bob.email, 'Can update tasks')
  await bob.page.reload()
  await bob.page.getByRole('checkbox', { name: 'Completed: Write announcement' }).click()
  await expect(bob.page.getByRole('checkbox', { name: 'Completed: Write announcement' })).toBeChecked()
  await drag(bob.page, 'Fix checkout', 'Done')
  await expect(column(bob.page, 'Done')).toContainText('Fix checkout')
  await expect(card(bob.page, 'Fix checkout')).toHaveCount(1)
  await card(bob.page, 'Fix checkout').click()
  await bob.page.getByRole('dialog').getByRole('button', { name: 'Delete card' }).click()
  await expect(bob.page.getByText('Ask the board admin for full access to do this.')).toBeVisible()
  await bob.page.reload()
  await expect(column(bob.page, 'Done')).toContainText('Fix checkout')
})

test('T-556 a removed member loses the board', async ({ browser }) => {
  const alice = await person(browser, 'alice')
  const bob = await person(browser, 'bob')
  const id = await share(alice.page, bob.page, bob.email)
  const panel = await openMembers(alice.page)
  await panel.getByRole('button', { name: `Remove ${bob.email}` }).click()
  await panel.getByRole('button', { name: 'Remove', exact: true }).click()
  await expect(panel.getByText(bob.email)).toHaveCount(0)
  await bob.page.goto(`/?board=${id}`)
  await expect(bob.page.getByRole('alert')).toContainText('Not found')
  await bob.page.goto('/')
  await bob.page.getByRole('button', { name: /switch board/ }).click()
  await expect(bob.page.getByRole('menu')).not.toContainText('Team plan')
})

test('T-557 T-558 members panel and invite page: phone, dark, Arabic, no axe violations', async ({ browser }) => {
  const alice = await person(browser, 'alice')
  const bob = await person(browser, 'bob')
  await share(alice.page, bob.page, bob.email)
  const signedIn = await alice.page.context().storageState()
  const context = await browser.newContext({ viewport: { width: 360, height: 780 }, colorScheme: 'dark', storageState: signedIn })
  await context.addInitScript(() => {
    localStorage.setItem('language', 'ar')
    localStorage.setItem('theme', 'dark')
  })
  const phone = await context.newPage()
  await phone.goto(alice.page.url())
  await phone.getByRole('button', { name: 'خيارات اللوحة' }).click()
  await phone.getByRole('menuitem', { name: 'الأعضاء' }).click()
  const dialog = phone.getByRole('dialog')
  await expect(dialog.getByRole('group', { name: `صلاحية ${bob.email}` })).toBeVisible()
  await expect(phone.locator('html')).toHaveAttribute('dir', 'rtl')
  expect(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const panelScan = await new AxeBuilder({ page: phone }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  expect(panelScan.violations.map((v) => v.id)).toEqual([])
  await dialog.getByLabel('دعوة بالبريد الإلكتروني').fill('carol@example.com')
  await dialog.getByRole('button', { name: 'دعوة', exact: true }).click()
  const link = await dialog.getByLabel('رابط الدعوة').inputValue()
  await phone.goto(new URL(link).pathname + new URL(link).hash)
  await expect(phone.getByRole('button', { name: 'قبول الدعوة' })).toBeVisible()
  expect(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const inviteScan = await new AxeBuilder({ page: phone }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  expect(inviteScan.violations.map((v) => v.id)).toEqual([])
})
