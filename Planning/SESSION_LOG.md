# Session Log

Handoff notes for the next working session. Read this first, then `CLAUDE.md`, then the Progress table in `Planning/PLAN.md`.

## Where the project stands (2026-10-20)

- Phases 1-11 are done (`main`, https://github.com/khaledhagar/TaskManager).
- Next: **Phase 12 - AI UI** (see "Next steps" below).
- Tests: backend 219 passing (plus 1 live AI test, skipped by default); frontend 171 passing. Lint, format and type checks are clean.
- Checklists: 148 tests ticked in `Planning/TEST_PLAN.md`, 55 items ticked in `Planning/SECURITY.md`.

| Done | Phase |
|------|-------|
| Yes | 1 Scaffolding, 2 Database, 3 Auth, 4 Board API, 5 AI backend, 6 Account security, 7 Frontend foundation, 8 Board UI, 9 Files, 10 Focus timer, 11 Languages |
| Next | 12 AI UI |
| Later | 13 Polish (touch drag, responsive + theme pass), 14 Hardening, 15 Playwright tests, 16 Done, 17 Deployment (Vercel) |

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
PYTHONUTF8=1 uv run --no-project python Planning/tick_phase.py "Phase 12 - AI UI" "T-212" "SEC-xx"
```

## Languages (Phase 11): how it works

- **Frontend:** messages live in `frontend/src/i18n/en.ts` (source of truth) and `ar.ts` (typed against it, so a missing key is a type error). In components use `const { t, rich } = useI18n()` from `i18n/context`; outside React use `t()` from `i18n/language`. Plurals: a message object `{ one, other, ... }` picked by `{count}`. `rich(key, { link: <Link/> })` puts React nodes into `{placeholders}`.
- **No hard-coded English:** `i18n/hardcoded.test.ts` parses every component (with `oxc-parser`) and fails on English text. Add new strings to both dictionaries. Technical strings go on its allow-list.
- **RTL:** CSS uses logical properties only (`margin-inline-start`, `inset-inline-end`, `text-align: start`). Direction icons get `className="flip-rtl"`. User-typed text gets `dir="auto"`.
- **Backend:** `app/i18n.py` reads `Accept-Language` per request (middleware + context variable). Wrap every user-facing message in `tr("English text", name=value)` and add the Arabic to `AR`. `tests/test_i18n.py` scans the source and fails on an `HTTPException` without `tr()` or a text without Arabic. Emails, demo board, templates (`app/templates_ar.py`) and AI prompts ("Answer in Arabic.") follow the request language.
- **Saved choice:** browser `localStorage` (`language`) and `users.language` (`PATCH /api/auth/me`). On sign-in a choice saved in the browser wins and is copied to the account; a fresh browser takes the account's language.
- Pydantic's 422 validation texts stay English (the frontend validates the same rules first, in the user's language).

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
- **Countdowns** (resend email, focus timer) are computed from a fixed end time, never by chaining one-second timers.
- **Origin check middleware** blocks cross-site POST/PUT/PATCH/DELETE; the Vite dev server origins (`localhost:5173`) are allowed outside production.

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

- Live account checks (moved to Phase 16 by the user): add to `.env` and test one real verification email and one real Google sign-in.
  - `EMAIL_MODE=smtp`, `SMTP_USER`, `SMTP_PASSWORD` (Gmail App Password; needs 2-step verification)
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (Google Cloud OAuth client; redirect `http://localhost:8000/api/auth/google/callback`)
- Optional: 10 OpenRouter credits would raise the AI limit from 50 to 1,000 requests per day.
- Delete the old local database before the next local run (see gotchas).

## Next steps: Phase 12 - AI UI

The backend endpoints exist (`/api/ai/cards/{id}/checklist`, `/api/ai/boards`, `/api/ai/chat`) and already answer in the request language. Test T-212 and the chat tests are in `TEST_PLAN.md`; the UI rules are in "AI Design" in `PLAN.md` (free-tier limits, confirm before any chat action).

Suggested order (test first at each step):

1. **Suggest checklist** button in the card window: show suggestions with checkboxes; only the selected items are added (T-212).
2. **New board dialog:** Blank, the four templates, or "Describe it to AI" (uses `/api/ai/boards`).
3. **Chat side panel:** message history, loading state, clear button; proposed actions shown with Confirm buttons; nothing changes without Confirm.
4. Every new string goes into `en.ts` and `ar.ts`; check RTL and phone width in the screenshot review.
5. **Review:** screenshots in both languages at 360, 768 and 1440 px, light and dark; then tick, commit and push.

Known polish items already logged for Phase 13: on phones the board "..." menu wraps onto its own line next to the focus timer; touch drag needs a press-and-hold sensor; native date inputs follow the browser's locale, not the page language.
