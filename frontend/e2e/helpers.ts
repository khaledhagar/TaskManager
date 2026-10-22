import { expect, type APIRequestContext, type Page } from '@playwright/test'

export const PASSWORD = 'Correct-Horse-42'
export const DEMO = 'Website Launch'

let counter = 0
/** A unique address for this test run. */
export const newEmail = (tag = 'user') => `${tag}.${Date.now()}.${process.pid}.${counter++}@example.com`

/** The link in the newest console email to `to`; waits until that email links to `page`. */
export async function emailLink(request: APIRequestContext, to: string, page: '/verify' | '/reset-password' = '/verify'): Promise<string> {
  let link = ''
  await expect(async () => {
    const mail = await (await request.get(`/__e2e/outbox?to=${encodeURIComponent(to)}`)).json()
    link = /https?:\/\/\S+#token=[\w-]+/.exec(mail.text ?? '')?.[0] ?? ''
    expect(link && new URL(link).pathname).toBe(page)
  }).toPass()
  return new URL(link).pathname + new URL(link).hash
}

/** Sign-in lands on the start page (T-801); open the first board (named `board`) from there. */
export async function openFirstBoard(page: Page, board = DEMO) {
  await page.getByRole('link', { name: new RegExp(`^${board}`) }).first().click()
  await expect(page.getByRole('heading', { name: board })).toBeVisible()
}

/** Start as a guest and open the first board. */
export async function startAsGuest(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Continue as guest' }).click()
  await expect(page.getByRole('heading', { name: 'Your work', level: 1 })).toBeVisible()
  await openFirstBoard(page)
}

/** The full example board (cards, labels, due dates) for a signed-up user, opened. */
export async function openExampleBoard(page: Page, email: string) {
  const { id } = await (await page.request.post(`/__e2e/example-board?email=${encodeURIComponent(email)}`)).json()
  await page.goto(`/?board=${id}`)
  await expect(page.getByRole('heading', { name: DEMO })).toBeVisible()
}

/** Sign up with email and password and open the verification link; ends signed in. */
export async function signUp(page: Page, email = newEmail(), password = PASSWORD) {
  await page.goto('/signin')
  await page.getByRole('link', { name: 'Create an account' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Repeat password').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible()
  await page.goto(await emailLink(page.request, email))
  await expect(page.getByRole('heading', { name: 'Your work', level: 1 })).toBeVisible()
  await openFirstBoard(page)
  return email
}

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto('/signin')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}

export async function accountMenu(page: Page, item: string) {
  await page.getByRole('button', { name: 'Account' }).click()
  await page.getByRole('menuitem', { name: item }).click()
}

/** Call the API from the page, with its cookie and Origin (as the app does). */
export async function api<T = unknown>(page: Page, method: string, path: string, body?: unknown): Promise<T> {
  return page.evaluate(
    async ([m, p, b]) => {
      const r = await fetch(p as string, {
        method: m as string,
        headers: b === undefined ? {} : { 'Content-Type': 'application/json' },
        body: b === undefined ? undefined : JSON.stringify(b),
      })
      return r.status === 204 ? null : r.json()
    },
    [method, path, body] as const,
  ) as Promise<T>
}

type BoardJson = { id: number; columns: { id: number; title: string; cards: { id: number; title: string }[] }[] }

/** Create a board with the given cards per column and open it. */
export async function openBoard(page: Page, title: string, cards: string[][] = [[], [], []]) {
  const board = await api<{ id: number }>(page, 'POST', '/api/boards', { title })
  const full = await api<BoardJson>(page, 'GET', `/api/boards/${board.id}`)
  for (const [i, titles] of cards.entries()) {
    for (const cardTitle of titles) await api(page, 'POST', `/api/columns/${full.columns[i].id}/cards`, { title: cardTitle })
  }
  await page.goto(`/?board=${board.id}`)
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  return board.id
}

export const getBoard = (page: Page, id: number) => api<BoardJson>(page, 'GET', `/api/boards/${id}`)

/** Card titles per column, as shown on screen. */
export const columnCards = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('section[aria-label]')].map((s) => [...s.querySelectorAll('li [dir=auto]')].map((e) => e.textContent)),
  )

export const column = (page: Page, title: string) => page.getByRole('region', { name: title, exact: true })
export const card = (page: Page, title: string) => page.getByRole('button', { name: new RegExp(`^${title}`) })

/**
 * Guests start with empty columns (2026-10-22). Add cards by title to the board on screen,
 * column by column, then reload so they show.
 */
export async function seedCards(page: Page, cards: string[][]) {
  const [first] = await api<{ id: number }[]>(page, 'GET', '/api/boards')
  const board = await getBoard(page, first.id)
  for (const [i, titles] of cards.entries()) {
    for (const title of titles) await api(page, 'POST', `/api/columns/${board.columns[i].id}/cards`, { title })
  }
  await page.reload()
  await expect(page.getByRole('button', { name: new RegExp(`^${cards.flat()[0]}`) })).toBeVisible()
}
