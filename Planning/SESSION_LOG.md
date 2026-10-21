# Session Log

Handoff notes for the next working session. Read this first, then `CLAUDE.md`, then the Progress table in `Planning/PLAN.md`.

## Where the project stands (2026-10-21)

- Phases 1-15 are done and pushed; Phase 16 is done except its final task (deleting local test data) (`main`, https://github.com/khaledhagar/TaskManager).
- **Next: Phase 17 (password strength).** New Phases 17-20 approved by the user on 2026-10-21 (password strength, board sharing backend, board sharing UI, public boards / assignment / meeting link); Deployment is now Phase 21 and starts with deleting the local test data (ask the user). Design: "Password Strength Design" and "Board Sharing Design" in PLAN.md; tests T-500 to T-589; security SEC-150 to SEC-174.
- Tests: backend 273 passing (99% coverage; plus 1 live AI test, skipped by default); frontend 209 passing; Playwright 59 passing (Edge full suite, Firefox and WebKit smoke). Lint, format and type checks are clean.
- Checklists: 214 tests ticked in `Planning/TEST_PLAN.md` (all ticked), 106 items ticked in `Planning/SECURITY.md` (all ticked).

| Done | Phase |
|------|-------|
| Yes | 1 Scaffolding to 15 Playwright tests |
| Next | 16 Done |
| Later | 17 Deployment (Vercel) |

## How we work (the user's preferences)

- One phase at a time. Tests first, then code. Finish with screenshots in a real browser (Edge via Playwright) and fix what the review finds.
- At the end of each phase: tick tasks, tests and security items, refresh the Progress table, commit, **push to GitHub**. One commit per phase.
- New features or plan changes: propose them first (with a recommendation), update `PLAN.md`, `SECURITY.md`, `TEST_PLAN.md` and `CLAUDE.md`, and only build after the user approves.
- Commit messages end with the `Co-Authored-By` line used in earlier commits.
- Keep explanations simple; the user prefers short summaries with a table of what changed.

## Run and test

```bash
# frontend (build is served by FastAPI)
cd frontend && npm run build
# backend server on http://localhost:8000
cd backend && uv run uvicorn app.main:app --port 8000

# tests
cd backend && uv run pytest -q                 # unit tests (live AI test skipped)
cd backend && uv run pytest -m live            # one real AI call (uses the free daily quota)
cd backend && uv run ruff check . && uv run ruff format --check .
cd frontend && npx vitest run && npx tsc -b --noEmit && npm run lint
```

Browser checks: Playwright drives the installed Microsoft Edge (`chromium.launch({ channel: 'msedge' })`), so no browser download is needed. `page.clock.install()` controls time (used for the focus timer). For a review on a clean database without touching the local one, start the server with `DATABASE_URL=sqlite:///<scratch>/review.db STORAGE_DIR=<scratch>/storage`.

Tick a finished phase and rebuild the Progress table:

```bash
PYTHONUTF8=1 uv run --no-project python Planning/tick_phase.py "Phase 14 - Security" "T-102" "SEC-50,SEC-51"
```

## Languages (Phase 11): how it works

- **Frontend:** messages live in `frontend/src/i18n/en.ts` (source of truth) and `ar.ts` (typed against it, so a missing key is a type error). In components use `const { t, rich } = useI18n()` from `i18n/context`; outside React use `t()` from `i18n/language`. Plurals: a message object `{ one, other, ... }` picked by `{count}`. `rich(key, { link: <Link/> })` puts React nodes into `{placeholders}`.
- **No hard-coded English:** `i18n/hardcoded.test.ts` parses every component (with `oxc-parser`) and fails on English text. Add new strings to both dictionaries. Technical strings go on its allow-list.
- **RTL:** CSS uses logical properties only (`margin-inline-start`, `inset-inline-end`, `text-align: start`). Direction icons get `className="flip-rtl"`. User-typed text gets `dir="auto"`.
- **Backend:** `app/i18n.py` reads `Accept-Language` per request (middleware + context variable). Wrap every user-facing message in `tr("English text", name=value)` and add the Arabic to `AR`. `tests/test_i18n.py` scans the source and fails on an `HTTPException` without `tr()` or a text without Arabic. Emails, demo board, templates (`app/templates_ar.py`) and AI prompts ("Answer in Arabic.") follow the request language.
- **Saved choice:** browser `localStorage` (`language`) and `users.language` (`PATCH /api/auth/me`). On sign-in a choice saved in the browser wins and is copied to the account; a fresh browser takes the account's language.
- Pydantic's 422 validation texts stay English (the frontend validates the same rules first, in the user's language).

## AI UI (Phase 12): how it works

- `frontend/src/api/ai.ts` calls the three AI endpoints; `ai/useAiRequest.ts` gives every AI action a busy flag, a friendly error and Cancel (AbortController, also on unmount).
- **Suggest steps** (`ai/ChecklistSuggest.tsx`) in the card window: suggestions arrive checked; only the selected ones are added through the normal checklist action.
- **New board dialog** (`shell/NewBoardDialog.tsx`): Blank, Sprint, Bug tracking, Personal (`POST /boards` with `template`), or "Describe it to AI" (`POST /ai/boards`).
- **Chat panel** (`ai/ChatPanel.tsx`, opened with "Ask AI" in the board header): conversation kept in the panel while the board is open (a new board starts a new chat); the last 20 messages are sent. Proposed actions are described in words (`ai/chatActions.ts`) and change the board only on Confirm, through the normal optimistic board actions. Replies are plain text (SEC-62); every AI feature says the text goes to a third-party AI service (SEC-76).
- Real check on 2026-10-20: an Arabic chat question was answered in Arabic in 6 seconds with a correct move proposal.
- Browser review without spending the AI quota: mock the AI routes with `page.route('**/api/ai/chat', ...)`.

## Polish (Phase 13): how it works

- **Touch drag:** `MouseSensor` + `TouchSensor` (press and hold 250 ms, 8 px tolerance) in `board/BoardColumns.tsx`; a quick swipe scrolls the page. `board/touch.test.tsx` covers both; checked in Edge with real touch events (CDP `Input.dispatchTouchEvent`; `Input.synthesizeScrollGesture` does not scroll in this setup, so don't use it).
- **Touch targets:** each CSS module ends with a `@media (pointer: coarse)` block raising controls to 40 px. Small visual controls (card check, color swatches) keep their look and get an invisible `::after` hit area. Playwright `hasTouch: true` turns on `(pointer: coarse)`.
- **Phone layout (max 640 px):** board title, then progress, then the `boardActions` group (focus timer, Ask AI, menu) which always wraps as one unit; filters in one row of three; columns snap gently (`scroll-snap-type: x proximity`).
- **Layout audit:** `cd frontend && node scripts/audit.cjs [--quick] [--shots]` (server on port 8000) checks every width, theme and language for sideways scroll, header rows and tap targets; screenshots in `frontend/test-results/audit`. Use it as the basis of T-329 in Phase 15.
- Drag: lift animation, dashed placeholder where the card will land, 200 ms drop (none with reduced motion). Empty board shows "no columns yet". Ctrl/Cmd+Enter saves a description. The chat panel leaves room for itself on screens 1024 px and wider.

## Environment notes and gotchas

- **Project lives in OneDrive with a deep path.** Installs were slow while OneDrive synced (sync is now paused by the user). Network to PyPI is slow (about 110 KB/s): use `UV_HTTP_TIMEOUT=300` for `uv add`.
- **Windows 260-character path limit:** LiteLLM's tokenizer cache path is too long. Fixed with `CUSTOM_TIKTOKEN_CACHE_DIR=C:/Users/khale/.cache/tiktoken` in `.env` (already set).
- **Write files containing Arabic as UTF-8.** Python on Windows defaults to cp1252: always pass `encoding="utf-8"` or run with `PYTHONUTF8=1`. A failed write once emptied `PLAN.md` (restored from git).
- **Local database:** `backend/taskmanager.db` is recreated on start but new columns are not added to an existing file. After a model change, delete it (only test data lives there). Alembic migrations come in Phase 17. **Phase 11 added `users.language`: delete `backend/taskmanager.db` and `backend/storage/` before the next local run** (Claude's delete was blocked by the permission check, so it was left in place).
- **Local uploads:** `backend/storage/` (git-ignored). Delete it together with the database.
- **FastAPI 0.149** keeps included routers as `_IncludedRouter` entries; to list endpoints use `app.openapi()["paths"]`, not `app.routes`.
- **Vitest fake timers:** use `vi.useFakeTimers({ shouldAdvanceTime: true })` with `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`; fully frozen timers make clicks hang.
- **jsdom** lacks `HTMLDialogElement.showModal` and `matchMedia`; small stand-ins live in `frontend/src/test/setup.ts`.
- **TypeScript 7** has no JavaScript compiler API; use `oxc-parser` to parse source in tests. Test files that use `node:fs` start with `/// <reference types="node" />`.
- **dnd-kit in RTL:** its keyboard moves pick Left/Right targets by left edge, so in RTL a card could not leave its column. `board/keyboard.ts` (`boardKeyboardCoordinates`) fixes it; keep using it as the keyboard `coordinateGetter`.
- **Grid layouts:** a grid column never shrinks below its content; the app shell uses `grid-template-columns: minmax(0, 1fr)` so the header can shrink on phones.
- **Effects must return nothing or a cleanup function.** Edge 155 returns a Promise from `scrollIntoView`; an expression-bodied `useEffect(() => el.scrollIntoView())` crashed the whole page (jsdom has no `scrollIntoView`, so unit tests missed it). Always use a block body.
- **Mixed directions:** text like "25 / 5" splits and reverses inside Arabic; wrap number pairs in `dir="ltr"` (done for the timer lengths).
- **Asymmetric shorthands** (`padding: 0 8px 0 10px`) do not mirror in RTL; use `padding-inline` / `margin-inline-start`.
- **Icon-only buttons need `aria-label`:** CSS that hides a button's text on phones also removes its accessible name (found on New board).
- **Countdowns** (resend email, focus timer) are computed from a fixed end time, never by chaining one-second timers.
- **Origin check middleware** blocks cross-site POST/PUT/PATCH/DELETE; the Vite dev server origins (`localhost:5173`) are allowed outside production.

- **`uv sync` "Access is denied" removing a package folder in `.venv`:** OneDrive leaves empty placeholder folders (ReadOnly + ReparsePoint + Pinned). Clear the flags and remove the empty folders (`attrib -R -P <dir>` then `rmdir`), then `uv sync --reinstall-package <name>`.
- **`npm run build` fails with EBUSY on `dist/assets`:** a shell whose working directory is inside `dist` locks it on Windows. `cd` out first.
- **Stopping a background server:** stopping the shell can leave the uvicorn child running on port 8000. Find it with `netstat -ano | grep ":8000 .*LISTEN"` and stop it with `taskkill //PID <pid> //T //F`.
- **Use `http://127.0.0.1:8000` in curl**, `localhost` may resolve to IPv6 and fail.

## Decisions already made

- **AI:** LiteLLM via OpenRouter, free models only (`nvidia/nemotron-3.5-super-vl:free`, backup `nvidia/nemotron-3-super-120b-a12b:free`). The user will not buy credits, so the account has **50 AI requests per day in total**. Cerebras was dropped (paid). Per-user limits (3/min, 10/day) are planned in Phase 14.
- **Database:** SQLite locally; production on Vercel with hosted Postgres (Neon or Supabase, chosen at deployment). Code follows the portability rules in `PLAN.md`.
- **File storage:** local folder now; S3-compatible storage at deployment (Cloudflare R2, or Supabase Storage if the database is Supabase).
- **Email:** Gmail SMTP with an App Password; console mode (links logged, kept in `app.state.mailer.outbox`) in development and tests.
- **Auth:** email + password with verification, Google sign-in (Authlib), guest mode; forgot / reset / change password; token version in the JWT signs out other sessions.
- **Focus timer:** opt-in (off by default), 25/5 or 50/10, frontend only.
- **Delete card / column:** 5-second Undo instead of a confirm dialog. Deleting labels, attachments, boards and accounts asks first.
- **Digits in Arabic:** Western 0-9 by default (`ar-u-nu-latn`); the user may switch to Arabic-Indic later.
- **Language button:** shows the other language in that language ("العربية" / "English"); on phones it shortens to "ع" / "EN". The "Task Manager" wordmark in the logo stays in English (brand); the page title is translated.
- **Server language:** taken from each request's `Accept-Language` (the browser always sends the chosen language), so emails go out in the language the person is using at that moment.

## Waiting on the user

- Optional: 10 OpenRouter credits would raise the AI limit from 50 to 1,000 requests per day.
- **First Phase 21 (Deployment) task:** delete `backend/taskmanager.db` and `backend/storage/` (stop the server first). Remind the user and do it only when they agree; the local database now holds their live-test accounts.
- The free AI quota is 50 requests per day for the whole account; Phase 12 used 1 for the live check.

## Hardening (Phase 14): how it works

- `app/hardening.py`: CSP, nosniff, Referrer-Policy, Permissions-Policy on every response; HSTS and `TrustedHostMiddleware` only in production; 1 MB limit for non-multipart bodies (413); generic translated 500 without stack traces. API docs off in production.
- `app/ratelimit.py`: `MemoryStore` + `RateLimiter` (fixed windows). Limits: sign in/up 10/min per IP (shared), guest 5/h per IP, forgot/resend 3/h per address and 10/h per IP, AI 3/min and 10/day per user, uploads 20/min per user. 429 with a translated message and `Retry-After`. **The guest limit is easy to hit during browser checks**: restart the server (memory store) or reuse one saved guest session (`context.storageState`).
- Email links carry the token after `#` (`/verify#token=...`, `/reset-password#token=...`).
- `app/main.py` turns on INFO logs for the `taskmanager` logger. Before this, console-mode emails (verification and reset links) were never printed, so local verification was impossible.
- Source checks: `backend/tests/test_checks.py` and `frontend/src/test/source.test.ts` (no file over 300 lines except `i18n/en.ts` / `ar.ts`, every `css.x` exists in its CSS module, no external URLs, bundle under 300 KB gzipped when `dist` exists).
- `board.module.css` was split into `board`, `column`, `card` and `cardWindow` modules.
- Coverage floor: `[tool.coverage.report] fail_under = 90` in `backend/pyproject.toml`.
- **Drag crash fixed:** with many cards, a card dragged into another column could flip back and forth between two columns until React stopped with "Maximum update depth exceeded" (blank page). Cause: `closestCorners` picks by the card's rectangle, and moving the card changes column heights. Fix: `board/collision.ts` picks the column under the pointer (`pointerWithin`), with `closestCorners` only for keyboard drags. `CardItem` is memoized and `renumber` keeps unchanged cards, so a drag redraws only cards that change.
- **NFR-03 left open:** with 200 cards there are still 2-3 pauses of about 170-200 ms per drag (dnd-kit re-measures every card). Recorded in `SECURITY.md`; needs the user's decision.
- Scratch scripts used for these checks (not in the repo): a 200-card drag with frame timing, and a drag regression check (reorder, cross-column, keyboard, reload).

## Playwright tests (Phase 15): how it works

- `cd frontend && npm run build && npx playwright test` (README has it). `playwright.config.ts` starts `e2e/server.py` on port 8001 with a fresh database in the system temp folder (`taskmanager-e2e`, outside OneDrive).
- `e2e/server.py` runs the real app, raises the rate limits (one machine is one IP), and adds `/__e2e` routes: `/outbox?to=` reads console emails (verification and reset links), and a fake Google OpenID provider (`/google/authorize`, `/token`, `/jwks`, `/google/identity` picks the next Google user).
- Edge runs every test; Firefox and WebKit run the tests tagged `@smoke` (T-355). First time on a new machine: `npx playwright install firefox webkit`.
- Live AI tests are tagged `@live` and skipped unless `LIVE=1` (uses the free daily quota).
- `e2e/helpers.ts`: `newEmail`, `emailLink`, `startAsGuest`, `signUp`. TypeScript for e2e is checked through `tsconfig.e2e.json`.
- Defects fixed in this phase: card check button raised to 24 px to click (WCAG 2.5.8; the circle stays 18 px); board switcher's accessible name starts with the board title (WCAG 2.5.3); link color darkened to `#146d9a` for 4.5:1 contrast.
- `TEST_PLAN.md` duplicate numbers (second T-330 / T-331) were renumbered.

## Next steps: Phases 17-20

Approved on 2026-10-21; details in PLAN.md. User decisions: public = read-only for anyone with the link, signed-in visitors can join as Viewer; every new member starts as Viewer; Request access button emails the admin; admin picks exactly one permission per member in a members panel; invites by email plus Copy / Share on WhatsApp. My calls (tell the user if questioned): any address can be invited (no user search, no account enumeration); public view hides attachments, member emails and AI; no live sync (board reloads on tab focus); Zoom meetings are links, not created by API.

## Phase 16 (2026-10-21): what was done

- Done: README; Lighthouse (T-405, NFR-04); card limit (NFR-03, T-407); server running for the user's manual test.
- Lighthouse: first run scored performance 73-76. Cause: the 510 KB JS bundle was sent uncompressed with no cache header. Fix in `app/frontend.py`: `/assets` gzipped (API responses are not, to avoid BREACH) and cached for a year (`immutable`); `index.html` gets `no-cache`. Now performance 94-96, accessibility 100 on `/signin` and the board. Rerun: start a server on a scratch DB, then `CHROME_PATH=<msedge.exe> npx lighthouse@13.5.0 <url> --only-categories=performance,accessibility` (board: pass the guest `session` cookie with `--extra-headers`).
- Card limit (user decision on NFR-03): `limits.CARDS_PER_BOARD = 100`; the 101st card returns 400 "Maximum cards in a board is 100. Delete a card to add a new one." (Arabic in `i18n.py`), shown as an error toast. Measured in Edge with 100 cards: no frame over 100 ms (at 200 cards dnd-kit paused 170-200 ms). T-354 e2e now fills a board to 100 and checks the message; the backend speed test still inserts 500 cards directly.
- Drag scripts: grab the card title, not its left edge (that is the completion circle, so the drag never starts).
- Tests at this point: backend 276 (99% coverage), frontend 210, Playwright 59; audits clean.
- Live checks passed on 2026-10-21 (T-165 email link confirmed an account, T-166 Google sign-in created an account). `.env` now has `EMAIL_MODE=smtp`, a Gmail App Password and a Google OAuth client (redirect `http://localhost:8000/api/auth/google/callback`; the JavaScript origins box takes only `http://localhost:8000`). A Gmail App Password is 16 lowercase letters; a normal password makes Gmail close the connection at login (`SMTPServerDisconnected`). The sender name is `Task Manager <SMTP_USER>`; Gmail may show a saved contact name instead, so use a dedicated Gmail account for the app in production.
