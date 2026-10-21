import { expect, test } from '@playwright/test'
import { startAsGuest } from './helpers.ts'

test.beforeEach(async ({ page }) => {
  await page.clock.install()
  await startAsGuest(page)
})

const chip = (page: import('@playwright/test').Page) => page.getByRole('button', { name: /^Focus timer: / })

test('T-325 timer: off by default, focus ends and break starts, resets, turn off', async ({ page }) => {
  await expect(chip(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Focus timer' }).click()
  const panel = page.getByRole('dialog', { name: 'Focus timer' })
  await panel.getByRole('button', { name: 'Start focus' }).click()
  await page.clock.runFor('10:00')
  await expect(chip(page)).toHaveAccessibleName(/15:00 Focus/)
  // Reset starts the focus again from the full length; it keeps running.
  await panel.getByRole('button', { name: 'Reset focus' }).click()
  await expect(chip(page)).toHaveAccessibleName(/2[45]:\d\d Focus/)
  await page.clock.runFor('25:01')
  await expect(chip(page)).toHaveAccessibleName(/Break/)
  await panel.getByRole('button', { name: /Start break|Pause/ }).first().click()
  await page.clock.runFor('02:00')
  await panel.getByRole('button', { name: 'Reset break' }).click()
  await expect(chip(page)).toHaveAccessibleName(/0[45]:\d\d Break/)
  await panel.getByRole('button', { name: 'Turn off focus timer' }).click()
  await expect(chip(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Focus timer' })).toBeVisible()
})

test('T-326 timer 50/10 mode, and its state is kept after reload', async ({ page }) => {
  await page.getByRole('button', { name: 'Focus timer' }).click()
  const panel = page.getByRole('dialog', { name: 'Focus timer' })
  await panel.getByRole('button', { name: '50 min focus, 10 min break' }).click()
  await expect(chip(page)).toHaveAccessibleName(/50:00 Focus/)
  await panel.getByRole('button', { name: 'Start focus' }).click()
  await page.clock.runFor('05:00')
  await page.reload()
  // The page clock keeps running in real time after the reload.
  await expect(chip(page)).toHaveAccessibleName(/4[45]:\d\d Focus/)
  await page.clock.runFor('45:01')
  await expect(chip(page)).toHaveAccessibleName(/(10:00|09:\d\d) Break/)
})
