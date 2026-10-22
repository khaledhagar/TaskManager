# Session Log

Handoff notes for the next working session. Read this first, then `CLAUDE.md`, then the Progress table in `Planning/PLAN.md`.

## Where the project stands (2026-10-22)

- Phases 1-15 are done and pushed; Phase 16 is done except its final task (deleting local test data) (`main`, https://github.com/khaledhagar/TaskManager).
- Phases 17 (password strength), 18 (sharing backend), 19 (sharing UI) and 20 (public boards, card assignment, meeting link) are done and pushed. **Phases 21-26 are done and pushed** (21 voice, waiting only for the user's real-microphone check; 22 comments, activity, Alembic; 23 notifications and reminders; 24 organize; 25 list view and export; 26 workspaces, start page, AI column suggestions, the user's bug list and the full regression). **Phase 27 (Voice Commands) is done and pushed (approved 2026-10-22). Next: Phase 28 (Deployment), which starts by asking the user before deleting local test data; do not start it without the user.** Phase 29 is Documentation (Word files). Deferred features are listed under "Deferred" in PLAN.md.
- Tests after the user's third check (2026-10-22, T-800 to T-805): backend 530 passing (99% coverage); frontend 387 passing; Playwright 127 passing (Edge full suite, Firefox and WebKit smoke). T-578 (three users in WebKit) has a 3 min limit: about 1 s per call was measured with three pages open. Lighthouse not rerun (last: performance 92-95, accessibility 100). `npm audit --omit=dev` and `pip-audit` clean at Phase 27.
- Checklists: every test up to T-805 is ticked except T-620 to T-627 (Phase 29, Documentation); open security items are only Deployment and Documentation ones.

| Done | Phase |
|------|-------|
| Yes | 1 Scaffolding to 20 Public boards / assignment / meeting link |
| Yes | 21 Voice (mic check done by the user 2026-10-22), 22 Collaboration, 23 Notifications, 24 Organize, 25 List view and export, 26 Workspaces and start page |
| Yes | 27 Voice commands |
| **In progress** | 28 Deployment (Vercel + Supabase): see "Phase 28 status" below and `Planning/vercel.txt` |
| Later | 29 Documentation (Word files) |

## Phase 28 status (deployment, 2026-10-22) - START HERE

**The user is new to deploying: one small step at a time, exact clicks, wait for them.** Their step-by-step guide for the open step is `Planning/vercel.txt` (no secrets in it).

**Where we stopped:** the site is live (2026-10-22): `/` and `/api/health` answer 200 on Supabase. Root cause of the earlier `FUNCTION_INVOCATION_FAILED` (`sqlite3.OperationalError`): the user had pasted the 14 variables of the local `.env` (no `DATABASE_URL`, `ENV`, `APP_URL`) instead of the 19 of `.env.vercel`; replaced and redeployed. A 400 on the per-deployment URL (`task-manager-<hash>-khaledelsaidhagar.vercel.app`) is expected: only the main host is in `ALLOWED_HOSTS`. Google sign-in works on the live site (callback added, tested with the user's account). The Google app was in Testing and Publish was disabled until the Branding page had a privacy policy link, so a public `/privacy` page was added (T-810). The privacy link is on the Google Branding page and the Google app is published (In production, 2026-10-22). Checked live with the user: email sign-up + confirmation email (Gmail SMTP), attachment upload / download / delete in the Supabase bucket. AI checklist works live. Live smoke suite: `cd frontend && npm run e2e:live` (Edge, guests only, deletes its guest; at most 5 guests per hour per IP; `LIVE_URL` overrides the address); passes. Still open: cold start and bundle size, full backend suite on Postgres (Alembic: all 7 migrations ran from scratch on `taskmanager_test`, no differences from the models) in `Planning/vercel.txt` ("STILL TO DO").

**Accounts and names**
- Live address: `https://task-manager-opal-xi-63.vercel.app` (Vercel project `task-manager`, team `khaledelsaidhagar`, Hobby, Root Directory `backend`, preset FastAPI). `APP_URL` in `.env.vercel` matches it.
- Supabase project `task-manager` in **eu-west-1 (Ireland)**, RLS on (automatic RLS event trigger `ensure_rls`), Postgres 17. Database `postgres` = production (tables already created and migrated to 0007 by starting the app locally with the production settings); database `taskmanager_test` = tests only.
- Supabase Storage bucket `task-manager-files` (private), S3 keys in `.env`.
- Emails: the user's current Gmail (App Password), decided 2026-10-22.

**Secrets (never print them, never commit them)**
- `.env` (local): adds `SUPABASE_DB_URL` (session pooler, port 5432) and `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. The local app ignores `SUPABASE_DB_URL`.
- `.env.vercel` (local, git-ignored by `.env.*`): the 19 production variables for Vercel: `ENV=production`, `APP_URL`, new `JWT_SECRET` and `CRON_SECRET`, `DATABASE_URL` (transaction pooler, **port 6543**), `FRONTEND_DIST=frontend_dist`, `EMAIL_MODE=smtp`, SMTP, Google, OpenRouter, S3, `LITELLM_LOCAL_MODEL_COST_MAP=True`, `CUSTOM_TIKTOKEN_CACHE_DIR=/tmp/tiktoken`.
- Check secrets only by shape (length, host, port) with a script; scratch scripts in the scratchpad read `../.env` from `backend/`.

**Code done this phase (pushed: `f1f2cb4`, `cc571e0`)**
- `db.engine_url`: `postgresql://` / `postgres://` -> `postgresql+psycopg://` (`psycopg[binary]` added). Postgres engines use `prepare_threshold=None` (the transaction pooler cannot keep prepared statements).
- `storage.S3Storage` + `make_storage(settings)`: S3 bucket when `S3_BUCKET` is set, else the local folder. Supabase answers a missing object with **404 and an empty error code** (not `NoSuchKey`); verified put/get/delete on the real bucket.
- Rate limits: `DbStore` (table `rate_counts`, migration `0007_rate_counts`, one upsert per hit) on Postgres, `MemoryStore` on SQLite (`ratelimit.make_store`). The user chose the database over Upstash Redis. `drop_expired` removes ended counters.
- On Vercel (`VERCEL=1` -> `settings.on_vercel`) the visitor IP comes from `x-real-ip` (Vercel overwrites it; it cannot be faked there).
- `routes/cron.py`: `GET /api/cron/reminders` and `GET /api/cron/cleanup` (old guests + ended counters) behind `Authorization: Bearer <CRON_SECRET>` (404 when no secret). Vercel Cron calls with GET, UTC; schedules in `backend/vercel.json` (cleanup 03:00, reminders 06:00), region `dub1`.
- Vercel build: `[tool.vercel.scripts] build` in `backend/pyproject.toml` builds the website into `backend/frontend_dist` (git-ignored). A relative `FRONTEND_DIST` is resolved inside `backend/`. FastAPI serves the site itself, so the CSP and other headers stay (Vercel keeps static files in the function when the app has middleware).
- Tests: `TEST_DATABASE_URL` runs the backend suite on Postgres (`tests/conftest.py`: first test drops the schema, later tests TRUNCATE). Runner script idea: read `SUPABASE_DB_URL`, swap the database name to `taskmanager_test`. About 8 s per test from Egypt to Ireland (the full suite is over an hour). `test_auth.py` passed on Supabase (30/30); **the full Postgres run was still going when the session ended: re-run it** (port 6543 too, to prove the pooler setting).
- Local suite: backend 547 passing (99% coverage).

**Still open in Phase 28 (in PLAN.md):** working deployment; full backend suite on Postgres; bundle size and cold start; Google OAuth callback for the live address (`/api/auth/google/callback`); file storage verified on the live site; Playwright smoke against the live URL; security headers, Secure cookie and HSTS on the live URL.

## Fixes from the user's third check (2026-10-22, T-800 to T-805)

- **Focus timer card list (T-800):** a long card title made the "Focus on a card" list 470 px wide inside a 300 px panel. Root cause: `.field` in `ui.module.css` was a grid whose column grew to its content; it is now `minmax(0, 1fr)` for every form field.
- **Landing (T-801):** every sign-in (email link, Google new or returning, guest) opens the start page. The `/?open=first` landing and `firstBoard` were removed; `App.signedIn` always goes to `/` (or a saved invitation / return path).
- **Empty first board (T-804):** new accounts, like guests, start with To Do / In Progress / Done and no cards or labels (`users.create_user` builds the demo template with `empty=True`). The business requirement in CLAUDE.md notes the change. Backend tests still get example cards through the autouse `example_cards` fixture in `tests/conftest.py`; tests of the real first board use `@pytest.mark.real_start`. In e2e, `openExampleBoard(page, email)` (test-only route `/__e2e/example-board`) gives the full example board; `openFirstBoard(page, name)` opens a board from the start page.
- **Task Manager name (T-805):** the header logo is a link to the start page (label "Task Manager, start page", since phones hide the word).
- **Delete a saved template (T-802):** a bin button on each "Your templates" tile on the start page, with a confirm window (`TemplateTiles.tsx`). Deleting was already possible in the New board window.
- **Meeting link (T-803):** "Send the link to members" (was "Email the link to members") emails each member and adds a `meeting` notification ("... invites you to a meeting for ...") that opens the board, where Start meeting is. The admin gets none. The link box stays in the Members window.

## Phase 27 notes (voice commands)

- **What it is:** one "Voice command" button (board header and start page) and the **V** shortcut. It listens in the app's language, shows the words, then either does a look-up at once (open card or board, search, filters including the new **Overdue** status filter, all boards, help) or shows a change as a sentence with **Confirm** / **Cancel** (add, move, complete, reopen, delete, rename, priority, due date, assign, add column). Several close names are offered as a choice. Phrases it does not understand (two words or more) are sent to the AI chat panel (`ChatPanel` `ask` prop). The window also has "Or type a command", so it works without a microphone (Firefox, keyboard users).
- **Code:** `src/voice/text.ts` (clean, `fold` keeps lengths so titles keep their Arabic spelling, `findMatches` with exact / contains / small-slip tiers), `when.ts` (due words and priorities), `commands.ts` (patterns in English and Arabic, `NEED` roles per change, `needBoard` on the start page), `describe.ts` (confirm sentences), `run.ts` (runs changes through the board's own actions, look-ups through filters and navigation), `VoiceCommand.tsx` (button and window). Texts under `vc.*` in `en.ts` / `ar.ts`.
- **Tests (all ticked):** T-780 to T-783 parser (`voice/commands.test.ts`), T-784 to T-788 window and board (`voice/VoiceCommand.test.tsx`, `board/voice.test.tsx`), T-789 to T-793 browser (`e2e/voiceCommands.spec.ts`, fake speech and a faked AI reply), T-794 full regression.
- **Security (both ticked):** SEC-218: a change goes only through the same actions as the buttons (the server's role checks stay the authority) and only after Confirm; the window checks the role first and explains whom to ask. SEC-219: nothing reaches the server or the AI until a change is confirmed or a phrase (two words or more) is passed to the AI chat; no audio is stored; the browser's speech-service notice is the one from Phase 21.
- **Gotchas:** the hard-coded-English test exempts `commands.ts` and `when.ts` (they hold the words people say, no interface text); boards made through the API in e2e have English column names; `npm run build` runs `tsc -b`, so a type error in an e2e file stops the build and the old frontend is served.

## Phase 26 notes (workspaces, start page, the user's bug list)

- **Second round of user fixes (2026-10-22, T-760 to T-770):** a failed email (Gmail unreachable for a moment) used to leave a half-made account: `MailError` now gives a translated 503, sign-up and guest upgrade are undone, reset/resend keep their neutral answer, assignment/mention/reminder/access-request emails are only logged; guests start with the column names only (`build_board(..., empty=True)`), new accounts keep the example cards; sign-up asks for the password twice; voice drops trailing "." in one-line fields and replaces their text (`MicButton sentences` keeps both for descriptions, comments, chat); the CSV is laid out like the board (each column's name, its tasks, a Status column); columns drag by their whole header (mouse/touch; keyboard stays on the grip) and wrap under 1024 px (stacked on phones); board options is a bold "..." icon and a Share button opens the sharing panel; a board can be deleted from its start-page tile. The user's stuck unconfirmed account was deleted at their request. E2E: `seedCards` adds cards to a guest's empty board; `board.spec` uses a signed-up account (full demo board).

- **Workspaces** (renamed from "projects" at the user's request): `workspaces` table, `boards.workspace_id` (FK `fk_boards_workspace_id`, ON DELETE SET NULL), migration `0005_workspaces`; `app/workspaces.py`, `app/routes/workspaces.py` (CRUD, `GET /api/workspaces/{id}/members` and `/api/workspaces/none/members`, owner only). Boards created with chosen columns and no cards (`POST /api/boards` with `columns`, `workspace_id`); `PATCH /api/boards/{id}` moves a board between workspaces. `BoardSummary` has `workspace_id`, `cards`, `done`; `BoardOut.workspace_id` only for the owner.
- **AI column names:** `app/columns_ai.py`, `POST /api/ai/columns`; falls back to To Do / In Progress / Done (`ai: false`) on 429/502 or when the user's AI limit is reached.
- **Start page** (`src/workspaces/`): `StartScreen` (start cards with the workspace/board explanations, What's new, Starred, workspaces, boards without a workspace, shared, your templates, archived), `WorkspacePanel` (left panel; a "Workspaces and boards" toggle under 1024 px), `MembersDialog`, `WhatsNew`, `TemplateTiles`, `NewWorkspaceDialog`, `ColumnsEditor`, `BlankBoardFields`; styles in `start.module.css`, `panel.module.css`, `editor.module.css`. Landing: returning sign-ins see the start page; a new guest, a just-verified account and a brand-new Google account open `/?open=first` (their demo board). "All boards" is a header icon (hidden on phones) and the first item of the board switcher.
- **Notifications:** `app/watch.py` adds `invited` (opens `/invite#token=...`; replaced on resend, removed on cancel or accept) and `card_changed` (others' changes to cards you are assigned to; one entry per card and person within 10 minutes; hooked into `activity.record`). Texts in `src/shell/notices.ts`, shared by the bell and What's new.
- **The user's bug list (2026-10-21), all fixed and tested (T-750 to T-757):** the port-8000 server was still running pre-Phase 23 code, so export, auto-complete and archive returned 404 (restart after every phase now; see memory); toasts now render inside the open dialog (a modal makes the rest of the page inert), so voice errors and Undo show and work in the card window; clearer blocked-microphone message; Move left / Move right in the column menu (mirrored in RTL); archive a whole column (`columns.archived_at`, migration `0006_column_archive`, filtered relationship plus `Board.archived_columns` cascade); labeled "Board options" button; Board / List switch with icons; saved templates on the start page; "Sign up to save your boards".
- **Gotchas:** importing `app.models_notify` before `app.models` in a test causes a circular import (import `Notification` from `app.models`); `[class*=columns]` now also matches the lucide `Columns3` icon (use `div[class*="_columns_"]`); OneDrive may refuse to delete an emptied folder (remove it from the shell later); generated migrations need `ruff format`.

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

- **Voice input (Phase 21): built; waiting only for the user's real-microphone check in Edge or Chrome.** Design in "Voice Input Design" in PLAN.md, tests T-600 to T-614, security SEC-180 to SEC-183. Key point: the server's `Permissions-Policy` currently blocks the microphone (`microphone=()`); the phase changes it to `microphone=(self)`. Do not start until the user approves the plan.
- **Documentation (Phase 29, after Deployment): planned.** Eight Word files in `Documentation/` (overview with short and long description, full documentation with features and target audience, test plan and test files, project plan, security, user flows, pages with screenshots, phases as build prompts). Design in "Documentation Design" in PLAN.md; tests T-620 to T-627; SEC-190. My calls (tell the user): made after Deployment so they describe the live app; English only; the test document lists every test file and its tests rather than printing all test code. Use the `anthropic-skills:docx` skill when building.
- **Projects and start screen (Phase 26): requested 2026-10-21.** Design in "Projects and Start Screen Design" in PLAN.md; tests T-720 to T-737; SEC-215, SEC-216. My calls: own phase (too big for Phase 25); the full regression moved to the end of Phase 26; deleting a project keeps its boards; a new guest still lands on the demo board.
- **List view and export (Phase 25) notes:** `?view=list` in the URL; `board/listLogic.ts` sorts (ties keep board order) and reuses the board filters; export at `GET /api/boards/{id}/export.csv|json` (any member), CSV with a byte order mark for Excel and formula cells prefixed with `'`, file named after the board (`filename*=UTF-8''...`).
- **Organize (Phase 24) notes:** archived cards are filtered out by the `BoardColumn.cards` relationship itself (a second `archived_cards` relationship cascades deletes so their files are removed); archived cards do not count toward the 100-card limit; duplicate and template copies go through `app/organize.py` and `seed.build_from_data` (cards accept `due_date` as well as `due`); the board header keeps its actions at the end when it wraps so the timer panel opens on screen.
- **Further features (Phases 22-25): approved 2026-10-21 after trimming.** Design in "Further Features Design (Phases 22-25)" in PLAN.md; tests T-640 to T-714; security SEC-200 to SEC-205, SEC-207, SEC-208, SEC-214. My calls: Alembic moves to the start of Phase 22; Viewers read but do not write comments; the notification count refreshes on load, focus and own actions (no timed polling).
- Optional: 10 OpenRouter credits would raise the AI limit from 50 to 1,000 requests per day.
- **First Phase 28 (Deployment) task:** delete `backend/taskmanager.db` and `backend/storage/` (stop the server first), only with the user's OK. On 2026-10-21 the user asked to remove their test accounts: all 3 users (and their boards) were deleted through the ORM; the database file itself is still there, empty.
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

## Password strength (Phase 17): how it works

- Rules in `backend/app/passwords.py` (`strength`, `require_not_weak`) and `frontend/src/auth/strength.ts`; both are tested against `backend/tests/password_cases.json`. Change one side, change both and add a case.
- Common list: `backend/app/common_passwords.txt` (lowercase, unique) with a copy in `frontend/src/auth/commonPasswords.ts` (a test checks they match; the hard-coded-English check skips that data file).
- Server: sign up, guest upgrade, reset and change/set password return 422 with a translated message for Weak. Reset checks strength before using up the link (`email_tokens.owner` peeks without consuming).
- Browser: `PasswordStrength` meter (role `meter` + polite `status` text) on sign up, reset, change/set password and guest upgrade; a Weak password shows "This password is too weak." on the field and sends nothing; the meter gives the specific advice. Sign in keeps the plain 8-character check.
- The page already has an empty `status` region (toasts), so in Playwright find the meter by its text or by role `meter`, not by `getByRole('status')`.

## Board sharing backend (Phase 18): how it works

- Tables: `board_members` (board, user, role `admin` / `editor` / `updater` / `viewer`; unique per board and user), `board_invites` (email, SHA-256 token hash, 7-day expiry, used_at), `access_requests` (one per member per board). New boards get the creator as `admin` (`seed.build_from_data`); `sharing.backfill_admins` runs at startup for older boards (idempotent), so existing local databases keep working without a reset.
- `app/access.py`: every lookup (`board_for`, `board_full_for`, `column_for`, `card_for`, `item_for`, `label_for`; `attachment_for` in `routes/files.py`) joins `board_members` for the user and takes the role the action needs. No row: 404. Lower role: 403 with "You can only view this board..." (viewer), "Ask the board admin for full access..." (updater), or "Only the board admin can do this." (admin-only). `board_role` returns the user's role.
- Role per endpoint (UI "Viewer / Can update tasks / Full access" = `viewer / updater / editor`): view board, members, attachments, AI chat = viewer; move card, PATCH card with only `completed`, PATCH checklist with only `done` = updater; every other card / column / label / checklist / attachment change and AI checklist = editor; rename / delete board, background, invites, members, requests = admin. Cards cannot move to another board (404). Board count and storage quota stay with the creator; attachments count against the uploader.
- `GET /boards` and `GET /boards/{id}` include `role`. `GET /boards/{id}/members` returns `role`, `members`, `invites` and `requests` (both empty for non-admins) and `requested` (the user has a pending request).
- Invites (`routes/invites.py`): admin only, not guests ("Create an account to share this board."); any address (never says whether it has an account); re-inviting a pending address reuses that invite with a fresh token; `resend` gives a new link (old one stops working); `preview` needs no sign-in; `accept` needs a verified, non-guest account with the invited email and adds a Viewer. Link: `APP_URL/invite#token=...`.
- Access requests (`routes/members.py`): Viewer or Can update tasks only; a second request while one is pending returns the same one without a new email; the admin gets an email linking to `APP_URL/?board={id}&members=1`. Approve (`updater` or `editor`) or decline (admin). Changing a member's role or removing them clears their pending request.
- Limits: 50 members and 20 pending invites per board; rate limits `ratelimit.INVITES` (20/h per user) and `ACCESS_REQUESTS` (3/day per member per board); `frontend/e2e/server.py` lifts them for browser tests.
- Tests: `tests/test_sharing_roles.py` (the role table over every endpoint), `test_sharing_invites.py`, `test_sharing_members.py`; helpers in `tests/sharing_helpers.py` (`join(admin, member, board_id, email, role)`).

## Board sharing UI (Phase 19): how it works

- API calls in `frontend/src/api/sharing.ts`; `Board` and `BoardSummary` carry `role` (`viewer` / `updater` / `editor` / `admin`).
- **Permission check before sending:** `board/permissions.ts` (`can`, `deniedKey`, `needFor`) mirrors the server table. In `board/useBoard.ts` every protected action starts with `allowed(need)`; a refused action returns `false`, sends nothing and shows a toast with the same text as the server's 403, plus a **Request access** button (not for admin-only actions) that calls `POST /boards/{id}/access-requests` and confirms "Request sent". `actions.allowed(need)` is also used by direct API callers: attachment upload (`files/AttachmentsSection.tsx`) and AI step suggestions (`ai/ChecklistSuggest.tsx`, prop `allowed`). Drag and drop go through `moveCard` / `reorderColumns`, so they are covered too. (An earlier version wrapped the whole actions object; React's lint flags that as reading refs during render, so each action checks itself.)
- The board reloads when the window regains focus (if no delete is waiting for Undo), so members see each other's changes.
- **Members panel** (`sharing/MembersPanel.tsx`, opened from the board menu "Members", or by `?members=1` from the access-request email): admin sees the invite form (`InviteForm`), the link box with Copy and Share on WhatsApp (`ShareLink`, `https://wa.me/?text=...`), member rows (`MemberRow`: a radio group per member, chosen permission shows at once, saved in the background; Remove asks first), access requests and pending invites (`PendingLists`: Send again gives a new link, Cancel). Members see the list read-only, their permission, Request access and Leave board. A guest admin sees "Create an account to share this board."
- Board menu: Members for everyone; Change background and Delete board for the admin only. Renaming the board as a member shows "Only the board admin can do this." and the switcher keeps the old name.
- **Invite page** `/invite#token=...` (`sharing/InvitePage.tsx`): preview without sign-in, Accept when signed in, a clear message for a wrong account with "Sign out and use another account". Signed-out visitors get Sign in / Create an account; the token waits in `localStorage` (`sharing/inviteStore.ts`) and `App` returns to `/invite` after sign-in or email verification.
- Board switcher groups "Your boards" (role admin) and "Shared with you".
- CSS gotchas: a `fieldset` does not shrink below its content (`min-inline-size: 0`), and grid rows need `grid-template-columns: minmax(0, 1fr)`, or a long email widens the dialog on phones. The visually hidden radio covers its label, so Playwright must `check()` the radio rather than click the text. After a drop, wait for the card count to be 1 (the drag overlay lingers 200 ms).
- E2E: `frontend/e2e/sharing.spec.ts` (two browser contexts: admin and member). Stop any server on port 8001 before `npx playwright test` (the runner starts its own and fails silently if the port is taken).

## Public boards, assignment, meeting link (Phase 20): how it works

- New tables only (no reset of existing databases): `public_links` (board_id unique, token), `meeting_links` (board_id unique, url), `card_assignees` (card_id, user_id).
- `PUT /boards/{id}/visibility {public}` (admin): public creates a new `secrets.token_urlsafe(32)` link `APP_URL/p/{token}`; private deletes the row so the old link 404s. `GET /api/public/boards/{token}` (no sign-in; `X-Robots-Tag: noindex`; rate limit `PUBLIC_VIEWS` 60/min per IP) returns `PublicBoardOut`: no board id, members, attachments or AI. `GET .../background`, `POST .../join` (signed-in non-guest becomes Viewer; members keep their role).
- `BoardOut` now has `public`, `public_link` (admin only), `meeting_url`, `members` (user_id, email); cards have `assignee_ids`. `PUT /cards/{id}/assignees` (Full access; only members, else 404). Removing a member deletes their assignments.
- `PUT /boards/{id}/meeting {url}` (admin; https with a host, max 500, else 422); `POST /boards/{id}/meeting/email` (admin; emails every other member; rate limit `MEETING_EMAILS` 3/h per board).
- `access.full_board_options()` loads everything in batches; the one-to-one links and member users use `joinedload` to keep the query count at 12 or below.
- Frontend: assignee picker in the card window (`board/AssigneePicker.tsx`, styles in `assignees.module.css`), initials on cards (max 3 + "+n"), "Assigned to me" option in the status filter (`Filters.assignee`), Start meeting link in the board header, `sharing/BoardLinks.tsx` (public switch with link, Copy and WhatsApp; meeting link save / email / remove) inside the members panel for the admin, `sharing/PublicBoardPage.tsx` at `/p/{token}` (read-only `CardItem readOnly`, Join board or Sign in to join; `inviteStore.rememberReturn` brings the visitor back after sign-in).
- Fixes found by the checks: dark `--primary-hover` raised to `#9655b4` (white text was 4.45:1); the public columns area is focusable (axe `scrollable-region-focusable`); a guest's own row in the assignee list reads "You"; links styled as buttons have no underline.
- The 500-card speed test pauses coverage and takes the best of 3 (real time is about 34 ms; coverage tracing and occasional disk or antivirus pauses made single timings 300-400 ms).
- E2E: `frontend/e2e/public.spec.ts`; shared two-user helpers in `frontend/e2e/sharingHelpers.ts`.

## Voice input (Phase 21): how it works

- `frontend/src/voice/useSpeech.ts` wraps the browser's `SpeechRecognition` / `webkitSpeechRecognition` (language `en-US` or `ar-EG` from the app language, interim results, stops after a pause). Errors map to translated messages (`not-allowed` / `service-not-allowed` blocked, `no-speech`, `network`, anything else "failed").
- `voice/MicButton.tsx` takes the field's `value` and `onChange`: live words appear in the field after what was already there; nothing is saved or sent. Optional `onEnd` (the card title puts focus back so Enter saves) and `maxLength`. It renders nothing without speech support (Firefox, jsdom). A one-time notice toast (localStorage `voiceNoticeSeen`) says the browser maker's service hears the audio. A visually hidden status says "Listening" / "Stopped". Styles in `voice.module.css` (pulse off with reduced motion, 40 px on touch).
- Placed in: column composer, card title, description (Write mode), checklist item, search, new board name (via `Field`'s new `after` prop) and "Describe it to AI", AI chat. Never on account screens (a test checks the auth files).
- Server: `Permissions-Policy: camera=(), microphone=(self), geolocation=()`.
- Tests: unit tests with `src/test/fakeSpeech.ts` (`installFakeSpeech`, `FakeRecognition.last.say(...)`); E2E `frontend/e2e/voice.spec.ts` installs a fake engine with `addInitScript` that "hears" `window.__words` and records `window.__speechLang`.
- Watch: once, in a full parallel Playwright run, `a11y.spec.ts` "T-336 Arabic (light)" failed; it passed 6 times alone and in the next full run. Not explained yet (possibly an animation caught mid-way under load); if it recurs, capture the axe output before changing anything.

## Collaboration (Phase 22): how it works

- **Alembic** (`backend/migrations/`, no `alembic.ini`; `app/migrate.py` runs at startup from `make_engine`): an empty database gets `create_all` and is stamped at head; a database without `alembic_version` (made before Phase 22) is stamped `0001_baseline` and upgraded; an up-to-date one is left alone. The migration scripts are read once per process (reading them took 200 ms per new test database and slowed the suite by a minute). The user's local database was upgraded this way on 2026-10-21 (now at `0002_comments_activity`).
- **New migration:** change the models, then generate against a scratch database at head:
  `uv run python -c "from alembic import command; from sqlalchemy import create_engine; from app.migrate import alembic_config; e=create_engine('sqlite:///<scratch>/m.db'); c=e.begin().__enter__(); cfg=alembic_config(c); command.upgrade(cfg,'head'); command.revision(cfg, message='...', autogenerate=True, rev_id='0003_...')"`. Review the file; `tests/test_migrations.py` checks migrations build exactly the models. Long lines in `migrations/versions/*` are allowed.
- **Tables** (`app/models_collab.py`, imported at the end of `models.py` to keep files short): `comments` (card, author, text up to 5,000, created, edited) and `activity` (board, card SET NULL, actor SET NULL, kind, JSON data, created).
- **Activity:** `app/activity.record(session, board_id, actor, kind, card=None, **data)` before each commit, in every changing endpoint (boards, columns, labels, cards, moves, labels, assignees, checklist, comments, attachments, background, members, invites, visibility, public join, meeting). Data holds titles, column and file names, member emails, roles; never descriptions or comment text (SEC-205). Newest `KEEP = 1000` kept per board. `GET /boards/{id}/activity?card_id=&before=&limit=` (members).
- **Comments:** `routes/comments.py`: list (viewer), add (updater), edit (author who can still comment), delete (author who can comment, or admin). Board cards carry `comment_count`. `app/comments.mentioned_members()` finds `@email` of board members (not the author); Phase 23 turns them into notifications.
- **Frontend:** `collab/CommentsSection.tsx` and `MentionInput.tsx` (combobox with member suggestions, arrows / Enter / Tab / Escape, click; Ctrl/Cmd+Enter sends; has the microphone), `ActivityList.tsx` (card History with Show more; `ActivityPanel` from the board menu "Activity"), `activityText.ts` (sentences from `activity.<kind>` keys, "You" / "Someone", translated roles; `timeAgo` with `Intl.RelativeTimeFormat`). Comment count icon on cards.
- A board loaded before someone joined has a stale member list until the board reloads (tab focus or reload); mention suggestions use that list.

## Notifications and reminders (Phase 23): how it works

- Tables (`app/models_notify.py`, migration `0003_notifications`): `notifications` (user, kind `assigned` / `mentioned` / `due_soon` / `overdue`, board, card, actor, JSON data with card and board titles, read_at) and `notification_settings` (user, `email` on/off, `last_reminder_on`).
- `app/notify.notify(...)` (called from `PUT /cards/{id}/assignees` for newly added people, and from `POST /cards/{id}/comments` for `@email` mentions): skips the actor and non-members, stores the notification, and emails it in the **recipient's** language when `emails_on` (verified, non-guest, setting on). Every email ends with `APP_URL/unsubscribe#token=<user id>.<HMAC of the app secret>`; `POST /api/notifications/unsubscribe` (no sign-in) checks it in constant time.
- `app/jobs.send_reminders(session, mailer, settings, today)`: open cards with assignees due today, tomorrow or overdue get one in-app notification per card, kind and day, and each user at most one digest email a day (`last_reminder_on`). Run by `POST /api/cron/reminders` with `Authorization: Bearer <CRON_SECRET>` (404 when `CRON_SECRET` is empty, 401 when wrong) or `uv run python -m app.jobs reminders`. Vercel Cron schedules it at Deployment.
- API: `GET /api/notifications` (unread count + newest 30, only boards the user still belongs to), `POST /{id}/read`, `POST /read-all`, `GET/PATCH /notifications/settings`.
- Frontend: `shell/NotificationBell.tsx` (badge, dialog list, opening one marks it read and goes to `/?board=..&card=..`; the board opens that card; refreshes on load, tab focus and opening, never on a timer), email switch in the account menu, `shell/UnsubscribePage.tsx` at `/unsubscribe`.
- Header at 360 px: with the bell added, the account menu was squeezed (menu wrappers have `min-width: 0`). Fix: `Menu` takes a `className`; the board switcher's wrapper shrinks (`.switcherMenu`), the account menu never does (`.accountMenu { flex: none }`).
- Multi-user Playwright files (`sharing`, `public`, `collab`, `notify`) use `test.describe.configure({ timeout: 120_000 })`: each signs up 2-3 people, and WebKit under 4 parallel workers needed more than 60 s (passes in about 18 s alone).

## Earlier next steps (Phases 17-20, done)

Approved on 2026-10-21; details in PLAN.md. User decisions: public = read-only for anyone with the link, signed-in visitors can join as Viewer; every new member starts as Viewer; Request access button emails the admin; admin picks exactly one permission per member in a members panel; invites by email plus Copy / Share on WhatsApp. My calls (tell the user if questioned): any address can be invited (no user search, no account enumeration); public view hides attachments, member emails and AI; no live sync (board reloads on tab focus); Zoom meetings are links, not created by API.

## Phase 16 (2026-10-21): what was done

- Done: README; Lighthouse (T-405, NFR-04); card limit (NFR-03, T-407); server running for the user's manual test.
- Lighthouse: first run scored performance 73-76. Cause: the 510 KB JS bundle was sent uncompressed with no cache header. Fix in `app/frontend.py`: `/assets` gzipped (API responses are not, to avoid BREACH) and cached for a year (`immutable`); `index.html` gets `no-cache`. Now performance 94-96, accessibility 100 on `/signin` and the board. Rerun: start a server on a scratch DB, then `CHROME_PATH=<msedge.exe> npx lighthouse@13.5.0 <url> --only-categories=performance,accessibility` (board: pass the guest `session` cookie with `--extra-headers`).
- Card limit (user decision on NFR-03): `limits.CARDS_PER_BOARD = 100`; the 101st card returns 400 "Maximum cards in a board is 100. Delete a card to add a new one." (Arabic in `i18n.py`), shown as an error toast. Measured in Edge with 100 cards: no frame over 100 ms (at 200 cards dnd-kit paused 170-200 ms). T-354 e2e now fills a board to 100 and checks the message; the backend speed test still inserts 500 cards directly.
- Drag scripts: grab the card title, not its left edge (that is the completion circle, so the drag never starts).
- Tests at this point: backend 276 (99% coverage), frontend 210, Playwright 59; audits clean.
- Live checks passed on 2026-10-21 (T-165 email link confirmed an account, T-166 Google sign-in created an account). `.env` now has `EMAIL_MODE=smtp`, a Gmail App Password and a Google OAuth client (redirect `http://localhost:8000/api/auth/google/callback`; the JavaScript origins box takes only `http://localhost:8000`). A Gmail App Password is 16 lowercase letters; a normal password makes Gmail close the connection at login (`SMTPServerDisconnected`). The sender name is `Task Manager <SMTP_USER>`; Gmail may show a saved contact name instead, so use a dedicated Gmail account for the app in production.
