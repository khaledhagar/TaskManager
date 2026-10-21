import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { api, column, openBoard, signIn, signUp, startAsGuest } from './helpers.ts'
import { openMembers, person, setRole } from './sharingHelpers.ts'

test.describe.configure({ timeout: 120_000 })

const main = (page: Page) => page.getByRole('region', { name: 'Your work' })
const panel = (page: Page) => page.getByRole('navigation', { name: 'Workspaces and boards' })

/** The AI column suggestion, faked at the network so tests never call the real model. */
async function fakeColumns(page: Page, boards: { title: string; columns: string[] }[]) {
  await page.route('**/api/ai/columns', (route) => route.fulfill({ json: { ai: true, boards } }))
}

test('T-732 create a workspace with two boards and AI columns; a board opens with empty columns @smoke', async ({ page }) => {
  await startAsGuest(page)
  await fakeColumns(page, [
    { title: 'Design', columns: ['Ideas', 'Drafts', 'Approved'] },
    { title: 'Development', columns: ['Backlog', 'Doing', 'Review', 'Shipped'] },
  ])
  await page.getByRole('button', { name: 'All boards' }).click()
  await main(page).getByRole('button', { name: 'New workspace' }).click()
  const dialog = page.getByRole('dialog', { name: 'New workspace' })
  await dialog.getByLabel('Workspace name').fill('Website relaunch')
  await dialog.getByLabel('Board 1 name').fill('Design')
  await dialog.getByRole('button', { name: 'Add another board' }).click()
  await dialog.getByLabel('Board 2 name').fill('Development')
  await dialog.getByRole('button', { name: 'Suggest columns with AI' }).click()
  await expect(dialog.getByRole('group', { name: 'Columns of Development' }).getByRole('textbox')).toHaveCount(4)
  await expect(dialog.getByText('Creates the workspace "Website relaunch" with 2 boards.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Create workspace' }).click()
  await expect(page.getByText('Workspace "Website relaunch" created')).toBeVisible()

  const ws = main(page).getByRole('region', { name: 'Website relaunch' })
  await ws.getByRole('link', { name: /^Development/ }).click()
  await expect(page.getByRole('heading', { name: 'Development', level: 1 })).toBeVisible()
  for (const name of ['Backlog', 'Doing', 'Review', 'Shipped']) {
    await expect(column(page, name).getByText('No cards here yet')).toBeVisible()
  }
  await column(page, 'Backlog').getByRole('button', { name: 'Add card' }).click()
  await page.getByRole('textbox', { name: 'Card title' }).fill('Set up the repo')
  await page.keyboard.press('Enter')
  await expect(column(page, 'Backlog').getByRole('button', { name: /^Set up the repo/ })).toBeVisible()
})

test('T-733 an empty account sees only the two start cards; a new board is then listed', async ({ page }) => {
  await signUp(page)
  const [demo] = await api<{ id: number }[]>(page, 'GET', '/api/boards')
  await api(page, 'DELETE', `/api/boards/${demo.id}`)
  await page.goto('/')
  await expect(main(page).getByText(/You have no boards yet/)).toBeVisible()
  await expect(main(page).getByRole('button', { name: 'New workspace' })).toHaveAccessibleDescription(/groups related boards/)
  await expect(panel(page)).toHaveCount(0)
  await main(page).getByRole('button', { name: 'New board' }).click()
  const dialog = page.getByRole('dialog', { name: 'New board' })
  await dialog.getByLabel('Board name').fill('Reading list')
  await dialog.getByRole('button', { name: 'Create board' }).click()
  await expect(page.getByRole('heading', { name: 'Reading list', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'All boards' }).click()
  await expect(main(page).getByRole('link', { name: /^Reading list/ })).toBeVisible()
})

test('T-729 sign-in opens the start page; a new guest opens the demo board', async ({ page, browser }) => {
  const email = await signUp(page)
  const other = await (await browser.newContext()).newPage()
  await signIn(other, email)
  await expect(main(other).getByRole('heading', { name: 'Your work', level: 1 })).toBeVisible()
  const guest = await (await browser.newContext()).newPage()
  await startAsGuest(guest)
  await expect(guest).toHaveURL(/open=first/)
})

test('T-737 T-738 left panel boards and members; Move to workspace updates switcher and start page', async ({ browser }) => {
  const alice = await person(browser, 'alice')
  const bob = await person(browser, 'bob')
  const { page } = alice
  const made = await api<{ workspace: { id: number } }>(page, 'POST', '/api/workspaces', { name: 'Launch', boards: [{ title: 'Ops', columns: ['To Do'] }] })
  const extra = await openBoard(page, 'Marketing')
  await page.getByRole('button', { name: 'Board options' }).click()
  await page.getByRole('menuitem', { name: 'Move to workspace' }).click()
  const move = page.getByRole('dialog', { name: 'Move to workspace' })
  await move.getByLabel('Workspace for "Marketing"').selectOption({ label: 'Launch' })
  await move.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Board moved')).toBeVisible()

  await page.getByRole('button', { name: /switch board/ }).click()
  const menu = page.getByRole('menu')
  await expect(menu.getByText('Launch', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')

  // Bob joins Marketing so the workspace has two members.
  const panelMembers = await openMembers(page)
  await panelMembers.getByLabel('Invite by email').fill(bob.email)
  await panelMembers.getByRole('button', { name: 'Invite' }).click()
  const link = await panelMembers.getByLabel('Invitation link').inputValue()
  await panelMembers.getByRole('button', { name: 'Close' }).click()
  await bob.page.goto(new URL(link).pathname + new URL(link).hash)
  await bob.page.getByRole('button', { name: 'Accept invitation' }).click()
  await expect(bob.page.getByRole('heading', { name: 'Marketing' })).toBeVisible()

  await page.getByRole('button', { name: 'All boards' }).click()
  const left = panel(page)
  await left.getByRole('button', { name: 'Boards: Launch' }).click()
  await expect(left.getByRole('link', { name: 'Marketing' })).toHaveAttribute('href', `/?board=${extra}`)
  await expect(main(page).getByRole('region', { name: 'Launch' }).getByRole('link')).toHaveCount(2)
  await left.getByRole('button', { name: 'Members: Launch' }).click()
  const members = page.getByRole('dialog', { name: 'Members of Launch' })
  await expect(members.getByRole('region', { name: 'Marketing' })).toContainText(bob.email)
  await expect(members.getByRole('region', { name: 'Ops' })).not.toContainText(bob.email)
  expect(made.workspace.id).toBeGreaterThan(0)
  await members.getByRole('button', { name: 'Close' }).click()
  await left.getByRole('link', { name: 'Marketing' }).click()
  await expect(page.getByRole('heading', { name: 'Marketing', level: 1 })).toBeVisible()
})

test('T-745 an invited and assigned person sees both on the start page and opens them', async ({ browser }) => {
  const alice = await person(browser, 'alice')
  const bob = await person(browser, 'bob')
  const id = await openBoard(alice.page, 'Team plan', [['Fix checkout'], [], []])
  const panelMembers = await openMembers(alice.page)
  await panelMembers.getByLabel('Invite by email').fill(bob.email)
  await panelMembers.getByRole('button', { name: 'Invite' }).click()
  await panelMembers.getByRole('button', { name: 'Close' }).click()

  await bob.page.goto('/')
  const news = main(bob.page).getByRole('region', { name: "What's new" })
  await news.getByRole('button', { name: new RegExp(`${alice.email.replace(/\./g, '\\.')} invited you to the board "Team plan"`) }).click()
  await bob.page.getByRole('button', { name: 'Accept invitation' }).click()
  await expect(bob.page.getByRole('heading', { name: 'Team plan', level: 1 })).toBeVisible()

  await setRole(alice.page, bob.email, 'Can update tasks')
  const [card] = (await api<{ columns: { cards: { id: number }[] }[] }>(alice.page, 'GET', `/api/boards/${id}`)).columns[0].cards
  const bobId = (await api<{ id: number }>(bob.page, 'GET', '/api/auth/me')).id
  await api(alice.page, 'PUT', `/api/cards/${card.id}/assignees`, { user_ids: [bobId] })
  const done = (await api<{ columns: { id: number }[] }>(alice.page, 'GET', `/api/boards/${id}`)).columns[2].id
  await api(alice.page, 'POST', `/api/cards/${card.id}/move`, { column_id: done, position: 0 })

  await bob.page.goto('/')
  const moved = main(bob.page).getByRole('button', { name: /moved "Fix checkout" on Team plan/ })
  await expect(moved).toBeVisible()
  await expect(main(bob.page).getByRole('button', { name: /assigned you to "Fix checkout"/ })).toBeVisible()
  await moved.click()
  await expect(bob.page.getByRole('dialog', { name: 'Fix checkout' })).toBeVisible()
})

test('T-734 T-735 start page and dialogs in Arabic, right to left, dark, at three widths; no axe violations', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('language', 'ar')
    localStorage.setItem('theme', 'dark')
  })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/signin')
  await page.getByRole('button', { name: 'المتابعة كضيف' }).click()
  await expect(page.getByRole('heading', { name: 'إطلاق الموقع' })).toBeVisible()
  await api(page, 'POST', '/api/workspaces', { name: 'إعادة إطلاق الموقع', boards: [{ title: 'التصميم', columns: ['أفكار', 'مسودات'] }] })
  await page.goto('/')
  const found: string[] = []
  const scan = async (where: string) => {
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
    found.push(...result.violations.flatMap((v) => v.nodes.map((n) => `${where} ${v.id}: ${n.target.join(' ')}`)))
  }
  for (const width of [390, 820, 1366]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.getByRole('heading', { name: 'عملك', level: 1 })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (width < 1024) await page.getByRole('button', { name: 'مساحات العمل واللوحات' }).click()
    await scan(`${width} start`)
    if (width < 1024) await page.getByRole('button', { name: 'مساحات العمل واللوحات' }).click()
  }
  await page.getByRole('region', { name: 'عملك' }).getByRole('button', { name: 'مساحة عمل جديدة' }).click()
  await expect(page.getByRole('dialog', { name: 'مساحة عمل جديدة' })).toBeVisible()
  await scan('new workspace')
  await page.keyboard.press('Escape')
  await page.getByRole('region', { name: 'عملك' }).getByRole('button', { name: 'لوحة جديدة' }).click()
  await scan('new board')
  expect(found).toEqual([])
})

test('T-735 the start flow works with the keyboard alone', async ({ page }) => {
  await startAsGuest(page)
  await page.goto('/')
  await expect(main(page)).toBeVisible()
  const target = panel(page).getByRole('button', { name: 'Boards: Boards without a workspace' })
  await target.focus()
  await page.keyboard.press('Enter')
  await expect(target).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Website Launch', level: 1 })).toBeVisible()
})
