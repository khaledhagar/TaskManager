import { readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { api, card, column, emailLink, openExampleBoard, PASSWORD } from '../e2e/helpers.ts'

/**
 * Records the feature video (step 2 of Documentation/build/build_video.py): each scene shows its caption,
 * plays its actions while the narration clip runs, and waits for the clip to end.
 */
const VIDEO = '../Documentation/video'
const SCRIPT: { id: string; text: string }[] = JSON.parse(readFileSync('../Documentation/build/video_script.json', 'utf8'))
const DURATIONS: Record<string, number> = JSON.parse(readFileSync(`${VIDEO}/durations.json`, 'utf8'))
const SARA = 'sara@example.com'
const OMAR = 'omar@example.com'
const SIZE = { width: 1280, height: 720 }

test.use({ launchOptions: { slowMo: 120 } })

/**
 * Caption bar at the bottom and a ring where the mouse clicks; both survive page loads.
 * The bar is a popover so it sits in the top layer, and it is raised again whenever a window opens.
 */
function overlay() {
  const draw = () => {
    let bar = document.getElementById('__caption')
    if (!bar) {
      bar = document.createElement('div')
      bar.id = '__caption'
      bar.setAttribute('aria-hidden', 'true')
      bar.setAttribute('popover', 'manual')
      bar.style.cssText =
        'position:fixed;inset:auto;margin:0;border:0;left:50%;bottom:24px;transform:translateX(-50%);max-width:82%;z-index:2147483647;' +
        'background:rgba(3,33,71,.92);color:#fff;font:500 21px/1.4 system-ui,sans-serif;padding:12px 22px;' +
        'border-radius:12px;border-bottom:4px solid #ecad0a;text-align:center;pointer-events:none;direction:ltr'
      document.body.appendChild(bar)
    }
    bar.textContent = sessionStorage.getItem('__caption') ?? ''
    raise(bar)
  }
  const raise = (bar: HTMLElement) => {
    if (bar.matches(':popover-open')) bar.hidePopover()
    if (bar.textContent) bar.showPopover()
  }
  let windows = 0
  setInterval(() => {
    const bar = document.getElementById('__caption')
    const open = document.querySelectorAll('dialog[open]').length
    if (bar && open !== windows) raise(bar)
    windows = open
  }, 150)
  addEventListener('DOMContentLoaded', draw)
  addEventListener('__caption', draw)
  addEventListener('mousedown', (e) => {
    const ring = document.createElement('div')
    ring.style.cssText =
      `position:fixed;left:${e.clientX - 18}px;top:${e.clientY - 18}px;width:36px;height:36px;border-radius:50%;` +
      'border:3px solid #ecad0a;z-index:2147483646;pointer-events:none;transition:transform .5s,opacity .5s'
    document.body.appendChild(ring)
    requestAnimationFrame(() => {
      ring.style.transform = 'scale(1.6)'
      ring.style.opacity = '0'
    })
    setTimeout(() => ring.remove(), 600)
  }, true)
}

test('feature video', async ({ browser }) => {
  test.setTimeout(30 * 60_000)
  const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir: `${VIDEO}/raw`, size: SIZE }, locale: 'en-US' })
  await context.addInitScript(overlay)
  const page = await context.newPage()
  const t0 = Date.now()
  const timeline: Record<string, number> = {}

  /** Shows the scene's caption, runs its actions, then waits until its narration has finished. */
  async function scene(id: string, actions: () => Promise<unknown> = async () => {}) {
    const text = SCRIPT.find((s) => s.id === id)!.text
    await page.evaluate((t) => {
      sessionStorage.setItem('__caption', t)
      dispatchEvent(new Event('__caption'))
    }, text)
    const start = Date.now()
    timeline[id] = start - t0
    await actions()
    const left = process.env.FAST ? 0 : DURATIONS[id] + 700 - (Date.now() - start)
    if (left > 0) await page.waitForTimeout(left)
  }

  const type = (target: ReturnType<Page['getByLabel']>, text: string) => target.pressSequentially(text, { delay: 35 })
  const tryAi = async (wait: () => Promise<unknown>) => {
    try {
      await wait()
    } catch {
      // The free AI is sometimes down; the narration still explains the feature.
    }
  }

  // Omar, the second person, signs up off camera.
  const omarPage = await (await browser.newContext({ viewport: SIZE })).newPage()
  await signUpAndVerify(omarPage, OMAR)
  const [omarFirst] = await api<{ id: number }[]>(omarPage, 'GET', '/api/boards')
  await api(omarPage, 'PATCH', `/api/boards/${omarFirst.id}`, { title: 'My first board' })

  await page.goto('/signin')
  await scene('intro')
  await scene('signup', async () => {
    await page.getByRole('link', { name: 'Create an account' }).click()
    await type(page.getByLabel('Email'), SARA)
    await type(page.getByLabel('Password', { exact: true }), PASSWORD)
    await type(page.getByLabel('Repeat password'), PASSWORD)
  })
  await scene('inbox', async () => {
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible()
  })
  const verifyLink = await emailLink(page.request, SARA)
  await scene('otherways', async () => {
    await page.getByRole('link', { name: 'sign in', exact: true }).click()
    await page.getByRole('link', { name: 'Continue with Google' }).hover()
    await page.waitForTimeout(1500)
    await page.getByRole('button', { name: 'Continue as guest' }).hover()
  })
  await scene('start', async () => {
    await page.goto(verifyLink)
    await expect(page.getByRole('heading', { name: 'Your work', level: 1 })).toBeVisible()
    const [first] = await api<{ id: number }[]>(page, 'GET', '/api/boards')
    await api(page, 'PATCH', `/api/boards/${first.id}`, { title: 'My first board' })
    await page.reload()
  })
  await scene('workspace', async () => {
    await page.getByRole('region', { name: 'Your work' }).getByRole('button', { name: 'New workspace' }).click()
    const ws = page.getByRole('dialog')
    await type(ws.getByLabel('Workspace name'), 'Website relaunch')
    await type(ws.getByLabel('Board 1 name'), 'Design')
    await ws.getByRole('button', { name: 'Add another board' }).click()
    await type(ws.getByLabel('Board 2 name'), 'Development')
    await ws.getByRole('button', { name: 'Create workspace' }).click()
  })
  await scene('templates', async () => {
    await page.getByRole('banner').getByRole('button', { name: 'New board' }).click()
    for (const name of [/^Sprint/, /^Bug tracking/, /^Personal/]) {
      await page.getByRole('dialog').getByRole('radio', { name }).check()
      await page.waitForTimeout(900)
    }
  })
  await scene('aiboard', async () => {
    const nb = page.getByRole('dialog')
    await nb.getByRole('radio', { name: /^Describe it to AI/ }).check()
    await type(nb.getByLabel('Describe your project'), 'Launch a small online bakery shop in six weeks')
    await nb.getByRole('button', { name: 'Create with AI' }).click()
    await tryAi(() => expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 90_000 }))
    await page.keyboard.press('Escape')
  })
  await openExampleBoard(page, SARA)
  const example = new URL(page.url()).pathname + new URL(page.url()).search
  await scene('board', async () => {
    await page.getByText('2 of 7 done').hover()
  })
  await scene('addcard', async () => {
    await column(page, 'To Do').getByRole('button', { name: 'Add card' }).click()
    await type(page.getByLabel('New card title'), 'Prepare launch email')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Escape')
  })
  await scene('drag', async () => {
    const a = (await card(page, 'Set up analytics').boundingBox())!
    const b = (await column(page, 'In Progress').boundingBox())!
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
    await page.mouse.down()
    for (let i = 1; i <= 25; i++) {
      await page.mouse.move(a.x + a.width / 2 + ((b.x + b.width / 2 - a.x - a.width / 2) * i) / 25, a.y + a.height / 2 + ((b.y + 200 - a.y - a.height / 2) * i) / 25)
    }
    await page.waitForTimeout(300)
    await page.mouse.up()
  })
  await scene('complete', async () => {
    await page.getByRole('checkbox', { name: 'Completed: Build sign-up API' }).click()
  })
  await scene('columns', async () => {
    await page.getByRole('button', { name: 'Add column' }).click()
    await type(page.getByRole('textbox', { name: 'Add column' }), 'Review')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Column options: To Do' }).click()
    await page.waitForTimeout(1800)
    await page.keyboard.press('Escape')
  })
  await scene('card', async () => {
    await card(page, 'Design pricing page').click()
    const cd = page.getByRole('dialog', { name: 'Design pricing page' })
    await type(cd.getByPlaceholder('Add an item and press Enter'), 'Add a yearly price toggle')
    await page.keyboard.press('Enter')
    await cd.getByLabel('Priority').selectOption({ label: 'Urgent' })
  })
  await scene('files', async () => {
    const cd = page.getByRole('dialog', { name: 'Design pricing page' })
    await cd.getByLabel('Choose files').setInputFiles({ name: 'pricing-notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Basic, Pro and Team plans') })
    await cd.getByRole('heading', { name: 'Comments' }).scrollIntoViewIfNeeded()
    await type(cd.getByLabel('Write a comment'), 'Can we show yearly prices too?')
    await cd.getByRole('button', { name: 'Comment', exact: true }).click()
  })
  await page.getByRole('dialog').last().getByRole('button', { name: 'Close' }).click()
  await scene('aisteps', async () => {
    await card(page, 'Write launch announcement').click()
    const ad = page.getByRole('dialog', { name: 'Write launch announcement' })
    await ad.getByRole('button', { name: 'Suggest steps' }).click()
    await tryAi(async () => {
      await expect(ad.getByText('Suggested steps')).toBeVisible({ timeout: 90_000 })
      await ad.getByText('Suggested steps').scrollIntoViewIfNeeded()
      await page.waitForTimeout(1500)
      await ad.getByRole('button', { name: /^Add \d+ steps?$/ }).click()
    })
  })
  await page.keyboard.press('Escape')
  await scene('assistant', async () => {
    await page.getByRole('button', { name: 'Ask AI' }).click()
    await type(page.getByLabel('Message'), 'Move the card "Prepare launch email" to In Progress.')
    await page.getByRole('button', { name: 'Send' }).click()
    await tryAi(async () => {
      await expect(page.getByRole('button', { name: /^Confirm/ }).first()).toBeVisible({ timeout: 90_000 })
      await page.waitForTimeout(1200)
      await page.getByRole('button', { name: /^Confirm/ }).first().click()
    })
  })
  await page.getByRole('button', { name: 'Close' }).first().click()
  await scene('search', async () => {
    await type(page.getByLabel('Search cards'), 'page')
    await page.waitForTimeout(1200)
    await page.getByLabel('Search cards').fill('')
    await page.getByLabel('Filter by priority').selectOption({ label: 'High' })
    await page.waitForTimeout(1200)
    await page.getByLabel('Filter by priority').selectOption({ label: 'Any priority' })
  })
  await scene('list', async () => {
    await page.getByRole('button', { name: 'List', exact: true }).click()
  })
  await page.getByRole('button', { name: 'Board', exact: true }).click()
  await scene('voice', async () => {
    await page.getByRole('button', { name: 'Voice command' }).click()
    const vc = page.getByRole('dialog', { name: 'Voice command' })
    await type(vc.getByLabel('Or type a command'), 'add card Buy domain to To Do')
    await vc.getByRole('button', { name: 'Go' }).click()
    await page.waitForTimeout(1500)
    await vc.getByRole('button', { name: 'Confirm' }).click()
  })
  await page.keyboard.press('Escape')
  await scene('timer', async () => {
    await page.getByRole('button', { name: 'Focus timer' }).click()
    await page.getByRole('button', { name: 'Start focus' }).click()
  })
  await page.keyboard.press('Escape')
  await scene('options', async () => {
    await page.getByRole('button', { name: 'Board options' }).click()
  })
  await scene('background', async () => {
    await page.getByRole('menuitem', { name: 'Change background' }).click()
    for (const name of ['Sky', 'Meadow', 'Dusk']) {
      await page.getByRole('dialog').getByRole('button', { name }).click()
      await page.waitForTimeout(900)
    }
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
  })
  let invite = ''
  await scene('share', async () => {
    await page.getByRole('button', { name: 'Share' }).click()
    const members = page.getByRole('dialog', { name: /^Members of/ })
    await type(members.getByLabel('Invite by email'), OMAR)
    await members.getByRole('button', { name: 'Invite' }).click()
    invite = await members.getByLabel('Invitation link').inputValue()
  })
  await omarPage.goto(new URL(invite).pathname + new URL(invite).hash)
  await omarPage.getByRole('button', { name: 'Accept invitation' }).click()
  await expect(omarPage.getByRole('heading', { name: 'Website Launch' })).toBeVisible()
  await page.keyboard.press('Escape')
  await scene('roles', async () => {
    await page.getByRole('button', { name: 'Share' }).click()
    const members = page.getByRole('dialog', { name: /^Members of/ })
    await members.getByRole('group', { name: `Permission for ${OMAR}` }).getByRole('radio', { name: 'Can update tasks' }).check()
    await members.getByRole('checkbox', { name: 'Anyone with the link can view' }).check()
    await members.getByLabel('Meeting link (Zoom, Google Meet, Teams)').scrollIntoViewIfNeeded()
    await type(members.getByLabel('Meeting link (Zoom, Google Meet, Teams)'), 'https://zoom.us/j/123456789')
    await members.getByRole('button', { name: 'Save link' }).click()
    await members.getByRole('button', { name: 'Send the link to members' }).click()
  })
  await page.keyboard.press('Escape')
  await page.reload()
  await scene('assign', async () => {
    await card(page, 'Fix checkout timeout').click()
    await page.getByRole('dialog').getByRole('group', { name: 'Assigned to' }).getByRole('checkbox', { name: /omar/ }).check()
  })
  await page.keyboard.press('Escape')
  await scene('member', async () => {
    await page.getByRole('button', { name: 'Account' }).click()
    await page.getByRole('menuitem', { name: 'Sign out' }).click()
    await page.getByLabel('Email').fill(OMAR)
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Your work', level: 1 })).toBeVisible()
    await page.waitForTimeout(2500)
    await page.getByRole('button', { name: /^Notifications/ }).click()
  })
  await page.keyboard.press('Escape')
  await page.goto(example)
  await scene('dark', async () => {
    await page.getByRole('button', { name: 'Switch to dark theme' }).click()
  })
  await scene('arabic', async () => {
    await page.getByRole('button', { name: 'العربية' }).click()
  })
  await page.getByRole('button', { name: 'English' }).click()
  await page.getByRole('button', { name: 'Switch to light theme' }).click()
  await scene('account', async () => {
    await page.getByRole('button', { name: 'Account' }).click()
  })
  await page.keyboard.press('Escape')
  await page.goto('/')
  await scene('outro')

  writeFileSync(`${VIDEO}/timeline.json`, JSON.stringify(timeline, null, 1))
  await context.close()
  copyFileSync(await page.video()!.path(), `${VIDEO}/raw.webm`)
})

async function signUpAndVerify(page: Page, email: string) {
  await page.goto('/signin')
  await page.getByRole('link', { name: 'Create an account' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Repeat password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible()
  await page.goto(await emailLink(page.request, email))
  await expect(page.getByRole('heading', { name: 'Your work', level: 1 })).toBeVisible()
}
