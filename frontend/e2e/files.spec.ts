import { expect, test, type Page } from '@playwright/test'
import { card, getBoard, openBoard, startAsGuest } from './helpers.ts'

const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n')

/** A real PNG drawn by the browser. */
async function png(page: Page, width = 120, height = 80): Promise<Buffer> {
  const data = await page.evaluate(
    ([w, h]) => {
      const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h })
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#209dd7'
      ctx.fillRect(0, 0, w, h)
      return canvas.toDataURL('image/png').split(',')[1]
    },
    [width, height],
  )
  return Buffer.from(data, 'base64')
}

test.beforeEach(async ({ page }) => startAsGuest(page))

test('T-322 upload a background photo; it shows after reload; remove it', async ({ page }) => {
  const id = await openBoard(page, 'Backdrop')
  await page.getByRole('button', { name: 'Board options' }).click()
  await page.getByRole('menuitem', { name: 'Change background' }).click()
  const dialog = page.getByRole('dialog', { name: 'Board background' })
  await dialog.getByLabel('Upload a photo').setInputFiles({ name: 'sky.png', mimeType: 'image/png', buffer: await png(page, 800, 500) })
  await expect.poll(async () => ((await getBoard(page, id)) as unknown as { background: { kind: string } }).background.kind).toBe('image')
  await page.keyboard.press('Escape')
  await page.reload()
  const backdrop = page.locator('[class*=backdrop]').first()
  await expect(backdrop).toHaveCSS('background-image', /background/)
  const image = await page.request.get(`/api/boards/${id}/background`)
  expect(image.headers()['content-type']).toBe('image/webp')
  await page.getByRole('button', { name: 'Board options' }).click()
  await page.getByRole('menuitem', { name: 'Change background' }).click()
  await dialog.getByRole('button', { name: 'Remove background' }).click()
  await expect.poll(async () => ((await getBoard(page, id)) as unknown as { background: { kind: string } }).background.kind).toBe('none')
})

test('T-323 attach a PDF and an image, download both, delete one', async ({ page }) => {
  await openBoard(page, 'Files', [['Contract']])
  await card(page, 'Contract').click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Choose files').setInputFiles([
    { name: 'terms.pdf', mimeType: 'application/pdf', buffer: PDF },
    { name: 'photo.png', mimeType: 'image/png', buffer: await png(page) },
  ])
  for (const name of ['terms.pdf', 'photo.png']) {
    const link = dialog.getByRole('link', { name })
    await expect(link).toBeVisible()
    const [download] = await Promise.all([page.waitForEvent('download'), link.click()])
    expect(download.suggestedFilename()).toBe(name)
  }
  await dialog.getByRole('button', { name: 'Delete terms.pdf' }).click()
  await dialog.getByRole('button', { name: 'Delete file' }).click()
  await expect(dialog.getByRole('link', { name: 'terms.pdf' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.reload()
  await expect(card(page, 'Contract')).toContainText('1')
})

test('T-324 a 5 MB file is refused with a clear message', async ({ page }) => {
  await openBoard(page, 'Big', [['Huge file']])
  await card(page, 'Huge file').click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Choose files').setInputFiles({ name: 'big.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(5 * 1024 * 1024) })
  await expect(dialog.getByRole('alert')).toContainText('The limit is 4 MB.')
  await expect(dialog.getByRole('link', { name: 'big.pdf' })).toHaveCount(0)
})
