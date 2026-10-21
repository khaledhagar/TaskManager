import { expect, test } from '@playwright/test'
import { api, card, getBoard, seedCards, startAsGuest } from './helpers.ts'

// Live tests call the real free model (the whole account has 50 requests a day): run with LIVE=1.
test.describe('live AI @live', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 })
  test.beforeEach(async ({ page }) => {
    await startAsGuest(page)
    await seedCards(page, [['Write launch announcement', 'Set up analytics']])
  })

  test('T-314 suggest steps adds the selected items to the checklist', async ({ page }) => {
    await card(page, 'Write launch announcement').click()
    const dialog = page.getByRole('dialog')
    const before = await dialog.getByRole('checkbox').count()
    await dialog.getByRole('button', { name: 'Suggest steps' }).click()
    await expect(dialog.getByText('Suggested steps')).toBeVisible({ timeout: 120_000 })
    await dialog.getByRole('button', { name: /^Add \d+ steps?$/ }).click()
    await expect.poll(() => dialog.getByRole('checkbox').count()).toBeGreaterThan(before)
  })

  test('T-315 the AI board starter creates a filled board', async ({ page }) => {
    await page.getByRole('button', { name: 'New board' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('radio', { name: /^Describe it to AI/ }).check()
    await dialog.getByLabel('Describe your project').fill('Plan a small family garden party for 20 people next month')
    await dialog.getByRole('button', { name: 'Create with AI' }).click()
    await expect(dialog).toHaveCount(0, { timeout: 120_000 })
    const id = Number(new URL(page.url()).searchParams.get('board'))
    const board = await getBoard(page, id)
    expect(board.columns.length).toBeGreaterThanOrEqual(3)
    expect(board.columns.flatMap((c) => c.cards).length).toBeGreaterThan(0)
  })

  test('T-316 chat answers about the board; a confirmed action is applied', async ({ page }) => {
    await page.getByRole('button', { name: 'Ask AI' }).click()
    const panel = page.getByRole('complementary', { name: 'AI assistant' }).or(page.getByRole('dialog', { name: 'AI assistant' }))
    await panel.getByLabel('Message').fill('Please move the card "Set up analytics" to the Done column.')
    await panel.getByRole('button', { name: 'Send' }).click()
    const confirm = panel.getByRole('button', { name: /^Confirm: Move "Set up analytics" to Done/ })
    await expect(confirm).toBeVisible({ timeout: 120_000 })
    await confirm.click()
    await expect(page.getByRole('region', { name: 'Done' }).getByText('Set up analytics')).toBeVisible()
  })
})

test('T-317 a chat action is not applied unless the user confirms it', async ({ page }) => {
  await startAsGuest(page)
  await seedCards(page, [['Write launch announcement']])
  const id = Number(new URL(page.url()).searchParams.get('board') ?? 0) || (await api<{ id: number }[]>(page, 'GET', '/api/boards'))[0].id
  const before = await getBoard(page, id)
  const moving = before.columns[0].cards[0]
  await page.route('**/api/ai/chat', (route) =>
    route.fulfill({
      json: { reply: 'I can move it for you.', actions: [{ type: 'move_card', card_id: moving.id, column_id: before.columns[2].id, title: null }] },
    }),
  )
  await page.getByRole('button', { name: 'Ask AI' }).click()
  await page.getByLabel('Message').fill('Move it to Done')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('I can move it for you.')).toBeVisible()
  await page.getByRole('button', { name: /^Dismiss: Move/ }).click()
  await page.reload()
  expect(await getBoard(page, id)).toEqual(before)
})
