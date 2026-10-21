import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { card } from './helpers.ts'
import { person, share } from './sharingHelpers.ts'

// Each test signs up two or three people in separate browsers; WebKit needs longer under load.
test.describe.configure({ timeout: 120_000 })

test('T-673 an assignment shows in the other member\'s bell and email; it opens the card @smoke', async ({ browser, request }) => {
  const alice = await person(browser, 'alice')
  const bob = await person(browser, 'bob')
  await share(alice.page, bob.page, bob.email)
  await alice.page.reload()
  await card(alice.page, 'Fix checkout').click()
  const group = alice.page.getByRole('group', { name: 'Assigned to' })
  await group.getByRole('checkbox', { name: new RegExp(bob.email.replace(/\./g, '\\.')) }).check()

  await expect(async () => {
    const mail = await (await request.get(`/__e2e/outbox?to=${encodeURIComponent(bob.email)}`)).json()
    expect(mail.subject).toBe(`${alice.email} assigned you to a card on Task Manager`)
    expect(mail.text).toContain('/unsubscribe#token=')
  }).toPass()

  await bob.page.goto('/')
  const bell = bob.page.getByRole('button', { name: 'Notifications, 1 unread' })
  await expect(bell).toBeVisible()
  await bell.click()
  await bob.page.getByRole('button', { name: /assigned you to "Fix checkout"/ }).click()
  await expect(bob.page.getByRole('dialog', { name: 'Fix checkout' })).toBeVisible()
  await expect(bob.page.getByRole('button', { name: 'Notifications, 0 unread' })).toBeVisible()
})

test('T-674 bell and list at phone width, dark, Arabic; email switch in the account menu; no axe violations', async ({ browser }) => {
  const alice = await person(browser, 'alice')
  const bob = await person(browser, 'bob')
  await share(alice.page, bob.page, bob.email)
  await alice.page.reload()
  await card(alice.page, 'Fix checkout').click()
  await alice.page.getByRole('combobox', { name: 'Write a comment' }).fill(`Hi @${bob.email}`)
  await alice.page.getByRole('button', { name: 'Comment', exact: true }).click()
  await expect(alice.page.getByRole('dialog').getByText(`Hi @${bob.email}`)).toBeVisible()

  const context = await browser.newContext({
    viewport: { width: 360, height: 780 },
    colorScheme: 'dark',
    storageState: await bob.page.context().storageState(),
  })
  await context.addInitScript(() => {
    localStorage.setItem('language', 'ar')
    localStorage.setItem('theme', 'dark')
  })
  const phone = await context.newPage()
  await phone.goto('/')
  await phone.getByRole('button', { name: 'الإشعارات، 1 غير مقروءة' }).click()
  await expect(phone.getByRole('dialog', { name: 'الإشعارات' })).toContainText('أشار إليك')
  expect(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const scan = await new AxeBuilder({ page: phone }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  expect(scan.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')}`))).toEqual([])
  await phone.keyboard.press('Escape')
  await phone.getByRole('button', { name: 'الحساب' }).click()
  await phone.getByRole('menuitem', { name: 'إشعارات البريد: مفعّلة' }).click()
  await expect(phone.getByText('تم إيقاف إشعارات البريد.')).toBeVisible()
})
