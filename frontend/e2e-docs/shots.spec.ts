import { expect, test, type Browser, type Page } from '@playwright/test'
import { api, card, emailLink, openExampleBoard, PASSWORD } from '../e2e/helpers.ts'

/** Screenshots for README.docx and 07_Pages.docx, saved as Documentation/Screenshots/NN-name.png. */
const DIR = '../Documentation/Screenshots'
const SARA = 'sara@example.com'
const OMAR = 'omar@example.com'
const AI_WAIT = { timeout: 120_000 }

/** Waits for fades and slides to finish so windows are fully drawn. */
async function shot(page: Page, name: string) {
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${DIR}/${name}.png`, animations: 'disabled' })
}

/** New accounts start with an empty board; give it its own name so it is not mixed up with the example board. */
async function renameFirstBoard(page: Page, title: string) {
  const [first] = await api<{ id: number }[]>(page, 'GET', '/api/boards')
  await api(page, 'PATCH', `/api/boards/${first.id}`, { title })
  await page.reload()
}

async function signUpAs(page: Page, email: string, before?: () => Promise<unknown>) {
  await page.goto('/signin')
  await page.getByRole('link', { name: 'Create an account' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Repeat password').fill(PASSWORD)
  await before?.()
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible()
}

async function verify(page: Page, email: string) {
  await page.goto(await emailLink(page.request, email))
  await expect(page.getByRole('heading', { name: 'Your work', level: 1 })).toBeVisible()
}

async function boardMenu(page: Page, item: string) {
  await page.getByRole('button', { name: 'Board options' }).click()
  await page.getByRole('menuitem', { name: item }).click()
}

const close = (page: Page) => page.getByRole('dialog').last().getByRole('button', { name: 'Close' }).click()

async function newPage(browser: Browser) {
  return (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' })).newPage()
}

test('screenshots', async ({ page, browser }) => {
  // Sign in, sign up, confirm email, guest
  await page.goto('/signin')
  await expect(page.getByRole('heading', { name: 'Sign in to Task Manager' })).toBeVisible()
  await shot(page, '01-sign-in')
  await signUpAs(page, SARA, () => shot(page, '02-create-account'))
  await shot(page, '03-check-your-inbox')
  await verify(page, SARA)
  await shot(page, '04-start-page-empty')
  await renameFirstBoard(page, 'My first board')

  // New workspace with two boards
  await page.getByRole('region', { name: 'Your work' }).getByRole('button', { name: 'New workspace' }).click()
  const ws = page.getByRole('dialog')
  await ws.getByLabel('Workspace name').fill('Website relaunch')
  await ws.getByLabel('Board 1 name').fill('Design')
  await ws.getByRole('button', { name: 'Add another board' }).click()
  await ws.getByLabel('Board 2 name').fill('Development')
  await shot(page, '05-new-workspace')
  await ws.getByRole('button', { name: 'Create workspace' }).click()
  await expect(page.getByText('Workspace "Website relaunch" created')).toBeVisible()

  // New board dialog: templates and AI board starter
  await page.getByRole('banner').getByRole('button', { name: 'New board' }).click()
  const nb = page.getByRole('dialog')
  await nb.getByLabel('Board name').fill('Team sprint')
  await nb.getByRole('radio', { name: /^Sprint/ }).check()
  await shot(page, '06-new-board-templates')
  await nb.getByRole('radio', { name: /^Describe it to AI/ }).check()
  await nb.getByLabel('Describe your project').fill('Launch a small online bakery shop in six weeks')
  await shot(page, '07-new-board-ai')
  await close(page)

  // The example board
  await openExampleBoard(page, SARA)
  const example = new URL(page.url()).pathname + new URL(page.url()).search
  await shot(page, '09-board')

  // Card window
  await card(page, 'Design pricing page').click()
  const cd = page.getByRole('dialog', { name: 'Design pricing page' })
  await expect(cd).toBeVisible()
  await shot(page, '10-card-details')
  await cd.getByLabel('Choose files').setInputFiles({ name: 'pricing-notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Basic, Pro and Team plans') })
  await expect(cd.getByRole('link', { name: 'pricing-notes.txt' })).toBeVisible()
  await cd.getByRole('heading', { name: 'Attachments' }).scrollIntoViewIfNeeded()
  await shot(page, '11-card-attachments')
  await cd.getByLabel('Write a comment').fill('Can we show yearly prices too?')
  await cd.getByRole('button', { name: 'Comment', exact: true }).click()
  await cd.getByRole('heading', { name: 'Comments' }).scrollIntoViewIfNeeded()
  await shot(page, '12-card-comments')
  await close(page)

  // Search, filters, list view
  await page.getByLabel('Search cards').fill('page')
  await shot(page, '14-search')
  await page.getByLabel('Search cards').fill('')
  await page.getByLabel('Filter by priority').selectOption({ label: 'High' })
  await shot(page, '15-filter-priority')
  await page.getByLabel('Filter by priority').selectOption({ label: 'Any priority' })
  await page.getByRole('button', { name: 'List', exact: true }).click()
  await shot(page, '16-list-view')
  await page.getByRole('button', { name: 'Board', exact: true }).click()

  // Voice command (typed here; the microphone works the same way)
  await page.getByRole('button', { name: 'Voice command' }).click()
  const vc = page.getByRole('dialog', { name: 'Voice command' })
  await vc.getByLabel('Or type a command').fill('add card Buy domain to To Do')
  await vc.getByRole('button', { name: 'Go' }).click()
  await shot(page, '18-voice-command')
  await vc.getByRole('button', { name: 'Confirm' }).click()
  await page.keyboard.press('Escape')

  // Focus timer
  await page.getByRole('button', { name: 'Focus timer' }).click()
  await shot(page, '19-focus-timer')
  await page.keyboard.press('Escape')

  // Board options menu, background, activity, archive, shortcuts
  await page.getByRole('button', { name: 'Board options' }).click()
  await shot(page, '20-board-options')
  await page.getByRole('menuitem', { name: 'Change background' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Dusk' }).click()
  await expect(page.getByText('Saving...')).toHaveCount(0)
  await shot(page, '21-background')
  await close(page)
  await boardMenu(page, 'Activity')
  await shot(page, '22-activity')
  await close(page)
  await card(page, 'Register domain').click()
  await page.getByRole('dialog', { name: 'Register domain' }).getByRole('button', { name: 'Archive' }).click()
  await boardMenu(page, 'Archived cards and columns')
  await shot(page, '23-archive')
  await close(page)
  await page.keyboard.press('?')
  await shot(page, '24-keyboard-shortcuts')
  await page.keyboard.press('Escape')

  // Sharing: invite Omar, public link, meeting link
  await page.reload()
  await boardMenu(page, 'Members')
  const members = page.getByRole('dialog', { name: /^Members of/ })
  await members.getByLabel('Invite by email').fill(OMAR)
  await members.getByRole('button', { name: 'Invite' }).click()
  const invite = await members.getByLabel('Invitation link').inputValue()
  await members.getByRole('checkbox', { name: 'Anyone with the link can view' }).check()
  const publicPath = new URL(await members.getByLabel('Public board link').inputValue()).pathname
  await members.getByLabel('Meeting link (Zoom, Google Meet, Teams)').fill('https://zoom.us/j/123456789')
  await members.getByRole('button', { name: 'Save link' }).click()
  await shot(page, '25-share-and-members')

  const omar = await newPage(browser)
  await signUpAs(omar, OMAR)
  await verify(omar, OMAR)
  await renameFirstBoard(omar, 'My first board')
  await omar.goto(new URL(invite).pathname + new URL(invite).hash)
  await expect(omar.getByRole('button', { name: 'Accept invitation' })).toBeVisible()
  await shot(omar, '26-invitation')
  await omar.getByRole('button', { name: 'Accept invitation' }).click()
  await expect(omar.getByRole('heading', { name: 'Website Launch' })).toBeVisible()

  await page.reload()
  await boardMenu(page, 'Members')
  await page.getByRole('group', { name: `Permission for ${OMAR}` }).getByRole('radio', { name: 'Can update tasks' }).check()
  await page.getByRole('button', { name: 'Send the link to members' }).click()
  await expect(page.getByText(/The meeting link was emailed/)).toBeVisible()
  await shot(page, '27-member-permissions')
  await close(page)
  await card(page, 'Fix checkout timeout').click()
  const fx = page.getByRole('dialog', { name: /^Fix checkout timeout/ })
  await fx.getByRole('group', { name: 'Assigned to' }).getByRole('checkbox', { name: /omar/ }).check()
  await fx.getByRole('group', { name: 'Assigned to' }).scrollIntoViewIfNeeded()
  await shot(page, '28-assign-card')
  await close(page)

  // Omar's notifications and start page
  await omar.goto('/')
  await expect(omar.getByRole('heading', { name: 'Your work', level: 1 })).toBeVisible()
  await shot(omar, '29-start-page-whats-new')
  await omar.getByRole('button', { name: /^Notifications/ }).click()
  await shot(omar, '30-notifications')
  await omar.keyboard.press('Escape')

  // Public read-only link, seen without signing in
  const visitor = await newPage(browser)
  await visitor.goto(publicPath)
  await expect(visitor.getByText('View only')).toBeVisible()
  await shot(visitor, '31-public-board')

  // Sara's start page with the workspace
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Your work', level: 1 })).toBeVisible()
  await shot(page, '32-start-page')

  // Account menu
  await page.getByRole('button', { name: 'Account' }).click()
  await shot(page, '33-account-menu')
  await page.keyboard.press('Escape')

  // Dark mode, Arabic, phone
  await page.goto(example)
  await expect(page.getByRole('heading', { name: 'Website Launch', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Switch to dark theme' }).click()
  await shot(page, '34-dark-mode')
  await page.getByRole('button', { name: 'Switch to light theme' }).click()
  await page.getByRole('button', { name: 'العربية' }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  await shot(page, '35-arabic')
  await page.getByRole('button', { name: 'English' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await expect(page.getByText('Fix checkout timeout on slow networks')).toBeVisible()
  await shot(page, '36-phone')

  // Guest start and privacy page
  const guest = await newPage(browser)
  await guest.goto('/signin')
  await guest.getByRole('button', { name: 'Continue as guest' }).click()
  await expect(guest.getByRole('heading', { name: 'Your work', level: 1 })).toBeVisible()
  await shot(guest, '37-guest')
  await guest.goto('/privacy')
  await shot(guest, '38-privacy')
})

/** The AI screenshots on their own: the free models are sometimes down, so this can be run again later. */
test('ai screenshots', async ({ page }) => {
  await signUpAs(page, 'lina@example.com')
  await verify(page, 'lina@example.com')

  await page.getByRole('banner').getByRole('button', { name: 'New board' }).click()
  const nb = page.getByRole('dialog')
  await nb.getByRole('radio', { name: /^Describe it to AI/ }).check()
  await nb.getByLabel('Describe your project').fill('Launch a small online bakery shop in six weeks')
  await nb.getByRole('button', { name: 'Create with AI' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0, AI_WAIT)
  await page.waitForTimeout(1500)
  await shot(page, '08-board-made-by-ai')

  await openExampleBoard(page, 'lina@example.com')
  await card(page, 'Write launch announcement').click()
  const ad = page.getByRole('dialog', { name: 'Write launch announcement' })
  await ad.getByRole('button', { name: 'Suggest steps' }).click()
  await expect(ad.getByText('Suggested steps')).toBeVisible(AI_WAIT)
  await ad.getByText('Suggested steps').scrollIntoViewIfNeeded()
  await shot(page, '13-ai-checklist')
  await close(page)

  await page.getByRole('button', { name: 'Ask AI' }).click()
  await page.getByLabel('Message').fill('Please move the card "Set up analytics" to the In Progress column.')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByRole('button', { name: /^Confirm/ }).first()).toBeVisible(AI_WAIT)
  await shot(page, '17-ai-assistant')
})
