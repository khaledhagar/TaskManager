# Session Log

Handoff notes for the next working session. Read this first, then `CLAUDE.md`, then the Progress table in `Planning/PLAN.md`.

## Where the project stands (2026-10-20)

- Phases 1-10 are done and pushed to GitHub (`main`, https://github.com/khaledhagar/TaskManager).
- Next: **Phase 11 - Languages: English and Arabic** (see "Next steps" below).
- Tests: backend 192 passing (plus 1 live AI test, skipped by default); frontend 146 passing. Lint, format and type checks are clean.
- Checklists: 136 tests ticked in `Planning/TEST_PLAN.md`, 52 items ticked in `Planning/SECURITY.md`.

| Done | Phase |
|------|-------|
| Yes | 1 Scaffolding, 2 Database, 3 Auth, 4 Board API, 5 AI backend, 6 Account security, 7 Frontend foundation, 8 Board UI, 9 Files, 10 Focus timer |
| Next | 11 Languages (Arabic / English, RTL) |
| Later | 12 AI UI, 13 Polish (touch drag, responsive + theme pass), 14 Hardening, 15 Playwright tests, 16 Done, 17 Deployment (Vercel) |

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

Browser checks: Playwright drives the installed Microsoft Edge (`chromium.launch({ channel: 'msedge' })`), so no browser download is needed. `page.clock.install()` controls time (used for the focus timer).

Tick a finished phase and rebuild the Progress table:

```bash
PYTHONUTF8=1 uv run --no-project python Planning/tick_phase.py "Phase 11 - Languages" "T-190,T-191" "SEC-143"
```

## Environment notes and gotchas

- **Project lives in OneDrive with a deep path.** Installs were slow while OneDrive synced (sync is now paused by the user). Network to PyPI is slow (about 110 KB/s): use `UV_HTTP_TIMEOUT=300` for `uv add`.
- **Windows 260-character path limit:** LiteLLM's tokenizer cache path is too long. Fixed with `CUSTOM_TIKTOKEN_CACHE_DIR=C:/Users/khale/.cache/tiktoken` in `.env` (already set).
- **Write files containing Arabic as UTF-8.** Python on Windows defaults to cp1252: always pass `encoding="utf-8"` or run with `PYTHONUTF8=1`. A failed write once emptied `PLAN.md` (restored from git).
- **Local database:** `backend/taskmanager.db` is recreated on start but new columns are not added to an existing file. After a model change, delete it (only test data lives there). Alembic migrations come in Phase 17.
- **Local uploads:** `backend/storage/` (git-ignored). Delete it together with the database.
- **FastAPI 0.149** keeps included routers as `_IncludedRouter` entries; to list endpoints use `app.openapi()["paths"]`, not `app.routes`.
- **Vitest fake timers:** use `vi.useFakeTimers({ shouldAdvanceTime: true })` with `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`; fully frozen timers make clicks hang.
- **jsdom** lacks `HTMLDialogElement.showModal` and `matchMedia`; small stand-ins live in `frontend/src/test/setup.ts`.
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

## Waiting on the user

- Live account checks (moved to Phase 16 by the user): add to `.env` and test one real verification email and one real Google sign-in.
  - `EMAIL_MODE=smtp`, `SMTP_USER`, `SMTP_PASSWORD` (Gmail App Password; needs 2-step verification)
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (Google Cloud OAuth client; redirect `http://localhost:8000/api/auth/google/callback`)
- Optional: 10 OpenRouter credits would raise the AI limit from 50 to 1,000 requests per day.

## Next steps: Phase 11 - Languages

Design is in `PLAN.md` ("Languages Design"); tests are T-190 to T-194, T-240 to T-246; security item SEC-143; quality items NFR-17, NFR-23 to NFR-25.

Suggested order (test first at each step):

1. **i18n core** in `frontend/src/i18n/`: `en.ts` (source of truth), `ar.ts` typed against it, `t(key, params)`, plural messages with `Intl.PluralRules('ar')`, date/number helpers. Tests T-240 to T-242.
2. **Language switch**: provider + `useI18n()`, saved in `localStorage`, sets `<html lang dir>`, button in the app header and on the sign-in layout; `api()` and the upload helper send `Accept-Language`. Tests T-243, T-244.
3. **Replace every hard-coded string** in components with `t()` (auth, shell, board, card window, files, timer, toasts, shortcuts). Add the source-scan test T-245 (allow-list technical strings).
4. **RTL**: convert CSS to logical properties (`left/right` -> `inset-inline-*`, `margin-left` -> `margin-inline-start`, `text-align: left` -> `start`); mirror direction icons (T-246); check dnd-kit drag and keyboard moves in RTL; the sign-in wall animation must travel right-to-left.
5. **Arabic font**: `npm install @fontsource-variable/ibm-plex-sans-arabic` (check the exact package name first), add to `--font` after Instrument Sans.
6. **Backend**: `users.language` (`en`/`ar`), `PATCH /auth/me`, read `Accept-Language`, translate user-facing `HTTPException` messages, Arabic email texts, Arabic demo board and templates (`app/templates.py`), language line in AI prompts (`app/assistant.py`). Tests T-190 to T-194. Delete the local database after adding the column.
7. **Review**: screenshots in Arabic at 360, 768 and 1440 px, light and dark; fix layout issues; then tick, commit and push.

Known polish items already logged for Phase 13: on phones the board "..." menu wraps onto its own line next to the focus timer; touch drag needs a press-and-hold sensor.
