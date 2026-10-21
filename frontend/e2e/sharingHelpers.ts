import { expect, type Browser, type Page } from '@playwright/test'
import { card, column, newEmail, openBoard, signUp } from './helpers.ts'

/** A fresh signed-up user in their own browser context. */
export async function person(browser: Browser, tag: string) {
  const page = await (await browser.newContext()).newPage()
  const email = await signUp(page, newEmail(tag))
  return { page, email }
}

export async function openMembers(page: Page) {
  await page.getByRole('button', { name: 'Board options' }).click()
  await page.getByRole('menuitem', { name: 'Members' }).click()
  return page.getByRole('dialog', { name: /^Members of/ })
}

/** Admin invites the member by email; the member opens the link and accepts. Returns the board id. */
export async function share(admin: Page, member: Page, memberEmail: string, cards = [['Write announcement', 'Fix checkout']]) {
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

export async function setRole(admin: Page, memberEmail: string, role: string) {
  const panel = await openMembers(admin)
  const radio = panel.getByRole('group', { name: `Permission for ${memberEmail}` }).getByRole('radio', { name: role })
  await radio.check()
  await expect(radio).toBeChecked()
  await panel.getByRole('button', { name: 'Close' }).click()
}

export async function drag(page: Page, from: string, to: string) {
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
