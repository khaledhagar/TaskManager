import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { card, column } from './helpers.ts'
import { drag, person, setRole, share } from './sharingHelpers.ts'

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']

test('T-653 two members comment on a card; a mention reaches the other @smoke', async ({ browser }) => {
  const alice = await person(browser, 'alice')
  const bob = await person(browser, 'bob')
  await share(alice.page, bob.page, bob.email)
  await setRole(alice.page, bob.email, 'Can update tasks')
  // Bob joined after Alice's board loaded; coming back to the tab (here: reload) refreshes members.
  await alice.page.reload()
  await card(alice.page, 'Fix checkout').click()
  const box = alice.page.getByRole('combobox', { name: 'Write a comment' })
  await box.fill('Please check this')
  await box.press('End')
  await box.type(' @bob')
  await alice.page.getByRole('option', { name: `@${bob.email}` }).click()
  await alice.page.getByRole('button', { name: 'Comment', exact: true }).click()
  await expect(alice.page.getByRole('dialog').getByText(`Please check this @${bob.email}`)).toBeVisible()
  await alice.page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
  await expect(card(alice.page, 'Fix checkout')).toContainText('1')

  await bob.page.reload()
  await card(bob.page, 'Fix checkout').click()
  const dialog = bob.page.getByRole('dialog')
  await expect(dialog.getByText(`Please check this @${bob.email}`)).toBeVisible()
  await dialog.getByRole('combobox', { name: 'Write a comment' }).fill('On it')
  await dialog.getByRole('button', { name: 'Comment', exact: true }).click()
  await expect(dialog.getByText('On it')).toBeVisible()
  await expect(dialog.getByText(`You commented on "Fix checkout"`)).toBeVisible()
})

test('T-654 the board Activity shows a card moved by another member', async ({ browser }) => {
  const alice = await person(browser, 'alice')
  const bob = await person(browser, 'bob')
  await share(alice.page, bob.page, bob.email)
  await setRole(alice.page, bob.email, 'Can update tasks')
  await bob.page.reload()
  await drag(bob.page, 'Write announcement', 'Done')
  await expect(column(bob.page, 'Done')).toContainText('Write announcement')
  await alice.page.getByRole('button', { name: 'Board options' }).click()
  await alice.page.getByRole('menuitem', { name: 'Activity' }).click()
  const panel = alice.page.getByRole('dialog', { name: 'Activity' })
  await expect(panel.getByText(`${bob.email} moved "Write announcement" to Done`)).toBeVisible()
  await expect(panel.getByText(`${bob.email} joined the board`)).toBeVisible()
})

test('T-652 T-655 comments, history and activity: phone, dark, Arabic; no axe violations', async ({ browser }) => {
  const alice = await person(browser, 'alice')
  const bob = await person(browser, 'bob')
  await share(alice.page, bob.page, bob.email)
  await card(alice.page, 'Fix checkout').click()
  await alice.page.getByRole('combobox', { name: 'Write a comment' }).fill('First note')
  await alice.page.getByRole('button', { name: 'Comment', exact: true }).click()
  await expect(alice.page.getByRole('dialog').getByText('First note')).toBeVisible()

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
  await card(phone, 'Fix checkout').click()
  const dialog = phone.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'التعليقات' })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'السجل' })).toBeVisible()
  await expect(dialog.getByText('علّق أنت على "Fix checkout"')).toBeVisible()
  expect(await fits()).toBe(true)
  expect(await scan()).toEqual([])
  await dialog.getByRole('button', { name: 'إغلاق' }).click()
  await phone.getByRole('button', { name: 'خيارات اللوحة' }).click()
  await phone.getByRole('menuitem', { name: 'النشاط' }).click()
  await expect(phone.getByRole('dialog', { name: 'النشاط' })).toBeVisible()
  expect(await fits()).toBe(true)
  expect(await scan()).toEqual([])
})
