// Layout audit (Phase 13): sideways page scroll, header rows, tap targets under 40 px on touch,
// for every width, theme and language. Screens: sign-in, board, timer, menu, card, chat, new board.
// Needs the server on http://localhost:8000. Run: node scripts/audit.cjs [--quick] [--shots]
// Screenshots go to test-results/audit (git-ignored). Basis for Playwright test T-329 (Phase 15).
const path = require('node:path')
const { chromium } = require('playwright')
const OUT = path.join(__dirname, '..', 'test-results', 'audit')
const SHOOT = process.argv.includes('--shots')

const T = {
  en: { guest: 'Continue as guest', board: 'Website Launch', card: /Design pricing page/, ask: 'Ask AI', newBoard: 'New board', timer: 'Focus timer', options: 'Board options' },
  ar: { guest: 'المتابعة كضيف', board: 'إطلاق الموقع', card: /تصميم صفحة الأسعار/, ask: 'اسأل الذكاء الاصطناعي', newBoard: 'لوحة جديدة', timer: 'مؤقت التركيز', options: 'خيارات اللوحة' },
}

/** Elements smaller than 40 px that a finger would tap (visible, enabled controls). */
const SMALL_TARGETS = (scope) => {
  const out = new Set()
  for (const el of document.querySelector(scope).querySelectorAll('button, a[href], input, select, textarea, [role=checkbox], [role=radio], summary, label[for]')) {
    if (el.closest('[hidden]') || el.disabled) continue
    const box = el.getBoundingClientRect()
    if (!box.width || !box.height) continue
    // An absolutely positioned ::after with a negative inset enlarges the tap area.
    const after = getComputedStyle(el, '::after')
    const grow = after.content !== 'none' && after.position === 'absolute' ? -parseFloat(after.top) || 0 : 0
    const r = { width: box.width + 2 * grow, height: box.height + 2 * grow }
    if (el.type === 'checkbox' || el.type === 'radio' || el.type === 'file' || el.tagName === 'LABEL') continue
    if (getComputedStyle(el).display === 'inline' || r.width <= 1) continue
    // An input inside a larger clickable wrapper (search box) is measured by its wrapper.
    if (el.tagName === 'INPUT' && el.closest('label')) continue
    if (el.matches('[class*=linkButton]') && el.closest('p, [class*=guestBar], [class*=switch]')) continue
    if (r.width < 39.5 || r.height < 39.5) {
      const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.tagName).trim().slice(0, 28)
      out.add(`${el.tagName.toLowerCase()}[${name}] ${Math.round(r.width)}x${Math.round(r.height)}`)
    }
  }
  return [...out]
}

async function screen(page, name, key, problems, touch, scope = 'body') {
  const extra = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  if (extra > 0) problems.push(`${key} ${name}: page scrolls sideways ${extra}px`)
  if (touch) {
    const small = await page.evaluate(SMALL_TARGETS, scope)
    if (small.length) problems.push(`${key} ${name}: ${small.length} small targets: ${small.slice(0, 40).join(', ')}`)
  }
  if (SHOOT) await page.screenshot({ path: path.join(OUT, `${name}-${key.replace(/ /g, '-')}.png`) })
}

async function run(browser, lang, width, theme, problems) {
  const x = T[lang]
  const touch = width <= 1024
  const key = `${lang} ${width} ${theme}`
  const context = await browser.newContext({ viewport: { width, height: 860 }, hasTouch: touch, isMobile: false })
  await context.addInitScript(([l, th]) => {
    localStorage.setItem('language', l)
    localStorage.setItem('theme', th)
  }, [lang, theme])
  const page = await context.newPage()
  page.on('pageerror', (e) => problems.push(`${key}: page error ${e.message}`))
  await page.goto('http://localhost:8000/signin')
  await page.waitForTimeout(300)
  await screen(page, 'signin', key, problems, touch)
  await page.getByRole('button', { name: x.guest }).click()
  await page.getByRole('heading', { name: x.board }).waitFor()
  await page.waitForTimeout(300)
  const layout = await page.evaluate(() => {
    const head = document.querySelector('[class*=boardHead]')
    const boxes = [...head.children].map((c) => c.getBoundingClientRect()).filter((r) => r.height > 0)
    boxes.sort((a, b) => a.top - b.top)
    let rows = 0
    let bottom = -1
    for (const r of boxes) if (r.top >= bottom - 2) { rows += 1; bottom = r.bottom } else bottom = Math.max(bottom, r.bottom)
    const cols = document.querySelector('[class*=columns]')
    return { rows, colsScroll: cols.scrollWidth > cols.clientWidth, colsOverflow: getComputedStyle(cols).overflowX }
  })
  const sameRow = await page.evaluate(([timer, options]) => {
    const mid = (el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2 }
    const a = [...document.querySelectorAll('button')].find((b) => b.textContent.includes(timer) || b.getAttribute('aria-label')?.startsWith(timer))
    const b = document.querySelector(`[aria-label="${options}"]`)
    return Math.abs(mid(a) - mid(b)) < 4
  }, [x.timer, x.options])
  if (!sameRow) problems.push(`${key} board: focus timer and board menu are on different rows`)
  if (layout.rows > (width <= 640 ? 3 : 2)) problems.push(`${key} board: header uses ${layout.rows} rows`)
  await screen(page, 'board', key, problems, touch)
  await page.getByRole('button', { name: x.timer }).click()
  await screen(page, 'timer', key, problems, touch, '[role=dialog]')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: x.options }).click()
  await screen(page, 'menu', key, problems, touch, '[role=menu]')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: x.card }).first().click()
  await page.getByRole('dialog').waitFor()
  await page.waitForTimeout(400)
  await screen(page, 'card', key, problems, touch, 'dialog[open]')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: x.ask }).click()
  await screen(page, 'chat', key, problems, touch, 'aside')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: x.newBoard }).first().click()
  await screen(page, 'newboard', key, problems, touch, 'dialog[open]')
  await context.close()
}

async function main() {
  require('node:fs').mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ channel: 'msedge' })
  const problems = []
  const widths = process.argv.includes('--quick') ? [360, 1440] : [360, 768, 1024, 1440]
  for (const lang of ['en', 'ar'])
    for (const theme of ['light', 'dark'])
      for (const width of widths) await run(browser, lang, width, theme, problems)
  await browser.close()
  console.log(problems.length ? problems.join('\n') : 'no problems found')
}

main()
