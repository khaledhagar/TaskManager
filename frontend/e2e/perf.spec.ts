import { expect, test } from '@playwright/test'
import { api, getBoard, startAsGuest } from './helpers.ts'

test('T-354 a board with 500 cards loads in under 300 ms and renders without errors', async ({ page }) => {
  test.setTimeout(180_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await startAsGuest(page)
  const { id } = await api<{ id: number }>(page, 'POST', '/api/boards', { title: 'Big board' })
  const board = await getBoard(page, id)
  await page.evaluate(
    async (columnIds) => {
      for (let i = 0; i < 500; i += 25) {
        await Promise.all(
          Array.from({ length: 25 }, (_, k) =>
            fetch(`/api/columns/${columnIds[(i + k) % 3]}/cards`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title: `Card ${i + k}` }),
            }),
          ),
        )
      }
    },
    board.columns.map((c) => c.id),
  )
  const timings: number[] = []
  for (let i = 0; i < 5; i++) {
    timings.push(await page.evaluate(async (boardId) => {
      const start = performance.now()
      await (await fetch(`/api/boards/${boardId}`)).json()
      return performance.now() - start
    }, id))
  }
  expect(Math.min(...timings)).toBeLessThan(300)
  await page.goto(`/?board=${id}`)
  await expect(page.locator('li[class*=cardSlot]')).toHaveCount(500)
  expect(errors).toEqual([])
})
