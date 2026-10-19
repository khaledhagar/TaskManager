# Task Manager - Implementation Plan

A professional Kanban task manager: FastAPI + SQLite backend, statically built React frontend served by FastAPI, with an AI assistant.
Each phase is small and must have all success criteria checked before the next phase starts.
The app will be published, so two companion checklists are part of every phase:

- `Planning/SECURITY.md`: security and non-functional requirements (SEC-xx, NFR-xx)
- `Planning/TEST_PLAN.md`: every test (T-xxx), written test first; a phase is done only when its tests pass

## Progress

| Phase | Tasks done | Status |
|-------|-----------|--------|
| Phase 1 - Scaffolding | 7 / 7 | Done |
| Phase 2 - Database and Models | 5 / 5 | Done |
| Phase 3 - Authentication and Authorization | 7 / 7 | Done |
| Phase 4 - Boards, Columns, Cards, Labels API | 6 / 6 | Done |
| Phase 5 - AI Backend | 7 / 7 | Done |
| Phase 6 - Account Security (backend) | 8 / 9 | Done (live Gmail/Google check moved to Phase 16) |
| Phase 7 - Frontend Foundation | 6 / 6 | Done |
| Phase 8 - Board UI | 11 / 11 | Done |
| Phase 9 - Files (attachments and board backgrounds) | 8 / 8 | Done |
| Phase 10 - Focus Timer (Pomodoro) | 6 / 6 | Done |
| Phase 11 - Languages: English and Arabic | 0 / 9 | Not started |
| Phase 12 - AI UI | 0 / 4 | Not started |
| Phase 13 - Polish | 0 / 8 | Not started |
| Phase 14 - Security and Non-Functional Hardening | 0 / 5 | Not started |
| Phase 15 - Integration Testing (Playwright) | 0 / 19 | Not started |
| Phase 16 - Done | 0 / 5 | Not started |
| Phase 17 - Deployment (Vercel) | 0 / 12 | Not started |

## Stack

| Layer | Choice |
|-------|--------|
| Backend | Python 3.13, FastAPI, uv project in `backend/` |
| Database | SQLite via SQLModel |
| Auth | Argon2 password hashing (`pwdlib`), JWT (`PyJWT`) in an httpOnly cookie, Google sign-in via `authlib` (OpenID Connect) |
| Files | `Pillow` checks and re-encodes images; storage behind one small interface: local folder in development, S3-compatible service in production (Cloudflare R2 or Supabase Storage, chosen at deployment) |
| Email | Gmail SMTP with an App Password (standard library `smtplib`); console mode logs links in development and tests |
| AI | LiteLLM -> OpenRouter free models: `nvidia/nemotron-3.5-super-vl:free`, backup `nvidia/nemotron-3-super-120b-a12b:free` |
| Frontend | React + TypeScript + Vite in `frontend/`, built to static files |
| Drag and drop | `@dnd-kit/core` + `@dnd-kit/sortable` |
| Languages | English and Arabic with a small typed dictionary per language (no library), `Intl` for dates, numbers and plural rules, right-to-left layout for Arabic, IBM Plex Sans Arabic via Fontsource |
| UI | Hand-written CSS with design tokens, `lucide-react` icons, self-hosted fonts via Fontsource, `react-markdown` |
| Security | Security headers middleware, in-memory rate limiter, `TrustedHostMiddleware`, Origin check |
| Unit tests | `pytest` + FastAPI `TestClient` (backend), `vitest` + Testing Library (frontend) |
| Integration tests | Playwright + `@axe-core/playwright` |
| Quality | `ruff`, `tsc --noEmit`, `pytest-cov`, `pip-audit`, `npm audit` |

## Scope

### Confirmed (MVP + approved enhancements)

1. Boards: create, rename, delete, switch between boards
2. Auth: sign up, sign in, sign out, guest mode
3. Demo board with dummy data for every new user and guest
4. Columns: start with 3 (To Do, In Progress, Done), rename, add, delete, drag to reorder
5. Cards: title, details/description, completed checkbox, add, delete, drag between and within columns
6. Card checklist: add, tick, rename, delete items, with progress indicator
7. Card due dates and color labels
8. Search and filter cards on a board (text, label, completed)
9. Dark mode
10. Guest upgrade: convert a guest into a regular account, keeping boards
11. Guest cleanup: guest accounts older than 7 days removed on startup
12. AI checklist generator: drafts checklist items from card title and details
13. AI board starter: describe a project, get a board pre-filled with columns and cards
14. AI chat assistant: side panel where the user asks anything about the app or their boards
15. Card priority (Low, Medium, High, Urgent) as a badge, filterable (N1)
16. AI chat can create, move and complete cards, each action confirmed by the user (N2)
17. Board templates: Blank, Sprint, Bug tracking, Personal (N3)
18. Undo toast after deleting a card or column (N4)
19. Board progress bar: percent of cards completed (N5)
20. Overdue and due-soon highlighting on cards (N6)
21. Keyboard shortcuts: N new card, / search, Esc close, ? help (N7)
22. Markdown rendering in card description (N8)
23. Delete account and all its data (needed for a published site, SEC-101)
24. Continue with Google: sign up and sign in with a Google account, no password needed
25. Email verification for email + password accounts (link valid 24 hours, single use)
26. Forgot password and reset password by email (link valid 30 minutes, single use)
27. Change password while signed in; Google-only users can add a password
28. Board background: upload a photo from the computer (shrunk in the browser, re-saved on the server) or pick a preset; remove it
29. File attachments on cards with limits: 4 MB per file, 10 files per card, 100 MB per account (10 MB for guests); images, PDF, text, CSV and Office files only
31. English and Arabic: a language button in the header and on the sign-in screen; Arabic switches the whole app to right-to-left; every text, server message, email, demo board, template and AI answer follows the chosen language
32. Dark mode in every screen and both languages (already built in Phase 7; verified again in Phase 13)
33. Responsive design: every feature works at phone (360 px), tablet (768 px), laptop (1024 px) and desktop (1440 px) widths, with touch drag and drop on phones
30. Pomodoro focus timer on the board, opt-in: off by default and turned on with a "Focus timer" button; 25 / 5 or 50 / 10 minutes, start, pause, reset focus, reset break, skip; chip with time left, chime and optional notification

### Enhancement review (N1-N8 approved on 2026-10-19; the rest deferred)

Reviewed against the confirmed list above for overlap and cost.

| # | Enhancement | Overlap with confirmed | Cost | Recommendation |
|---|-------------|------------------------|------|----------------|
| N1 | Card priority (Low, Medium, High, Urgent) shown as a badge, filterable | Extends #8 filter | Small | Include |
| N2 | AI chat can act on the board (create, move, complete cards) via tool calls, with a confirm step | Extends #14 | Medium | Include |
| N3 | Board templates (Blank, Sprint, Bug tracking, Personal) when creating a board | Shares seed logic with #3 and #13 | Small | Include |
| N4 | Undo toast after deleting a card or column | None | Small | Include |
| N5 | Board progress bar (percent of cards completed) | Uses #5 completed flag | Tiny | Include |
| N6 | Overdue and due-soon highlighting on cards | Uses #7 due dates | Tiny | Include |
| N7 | Keyboard shortcuts: N new card, / search, Esc close, ? help | Uses #8 search | Small | Include |
| N8 | Markdown rendering in card description | None | Small | Include |
| N9 | WIP limit per column (column header warns when exceeded) | None | Small | Optional |
| N10 | Card activity log (created, moved, completed, with times) | None | Medium | Optional |
| N11 | Export board as JSON | None | Small | Optional |
| N12 | Board sharing with members and roles (owner, editor, viewer) | Changes auth model from #2 | Large | Not for this version |
| N13 | Real-time sync between open browsers | Needs N12 | Large | Not for this version |
| N14 | File attachments on cards | None | Large | Not for this version |

## UI/UX Specification

Goal: calm, fast, professional - in the spirit of Linear and Trello, but simpler.

- Layout: slim top bar (logo, board switcher, search, AI chat toggle, theme toggle, account menu); board header with title, progress bar and filters; columns as rounded panels that scroll horizontally; chat as a right-side drawer.
- Concept: a planning wall. The board is a calm, cool surface; cards are crisp paper. The one bold moment is the sign-in screen: a live miniature board on navy where a card slides from To Do to Done, showing the product's job. Everything else stays quiet.
- Typography: Instrument Sans (variable, self-hosted), 14 px base, scale 12 / 14 / 16 / 20 / 28 / 40, weights 400 / 500 / 600, slightly tight tracking on headings, sentence case everywhere (no all-caps labels).
- Contrast (measured 2026-10-20): brand blue `#209dd7` (3.06:1) and gray `#888888` (3.54:1) fail AA for small text on white, so they are used for focus rings, icons and large text only; small text uses `#64686f` (5.22:1) and links use `#1677a8` (4.95:1). Dark theme: wall `#04193a`, cards `#0b2a55`, text `#e7edf5`, muted `#9aa6b8`, links `#4fb6e6`, primary `#8a4aa8`.
- Color roles: purple `#753991` primary buttons, blue `#209dd7` links and focus rings, yellow `#ecad0a` accent lines, the progress bar and due-soon state; red for overdue and destructive actions. Dark theme uses deep navy surfaces with the same accents, contrast checked to 4.5:1.
- Spacing and shape: 4 px grid; radius by size, not one value everywhere: 6 px controls, 8 px cards, 14 px panels and dialogs; light wall `#f5f7fa` with white cards and a single soft shadow only on lifted or dragged cards.
- Feedback: optimistic updates everywhere; skeleton loaders on first load; toasts for errors and undo; inline editing (click a title, Enter saves, Esc cancels).
- Cards: title, then a compact meta row (priority dot, labels as small pills, due date chip, checklist progress like "3/5"); completed cards are dimmed with a strikethrough title.
- Card modal: two-column on desktop (content left; priority, due date, labels and AI actions right), full-screen sheet on mobile.
- Motion: 150-200 ms ease-out transitions, drag overlay with a slight tilt, all disabled under `prefers-reduced-motion`.
- Empty states: short helpful text plus one clear action (for example "No cards yet - press N to add one").
- Accessibility: keyboard for everything, visible focus rings, ARIA labels on icon buttons, screen-reader announcements for drag and drop.
- The `frontend-design` skill guides the visual pass in Phase 13; screenshots are reviewed at 360, 768 and 1440 px in both themes.

## Production Portability

Built and tested locally on SQLite; deployed later to Vercel with hosted Postgres (Neon or Supabase, chosen at deployment).
These rules keep that move to one small phase:

1. All configuration comes from environment variables (`DATABASE_URL`, `JWT_SECRET`, `OPENROUTER_API_KEY`, `ENV`, `ALLOWED_HOSTS`, `REDIS_URL`, `APP_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_MODE`, `STORAGE_MODE`, `STORAGE_DIR`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`).
2. No SQLite-specific SQL. The SQLite pragmas (foreign keys, WAL) are applied only when the URL is SQLite.
3. Rate-limit counters live behind one small store class: in-memory locally, Redis (Upstash) in production.
4. Background jobs (guest cleanup) are plain functions, called on startup locally and from a protected cron endpoint on Vercel.
5. Nothing is written to local disk at runtime except the SQLite database and, in development only, the local file storage folder. Production files go to S3-compatible storage through the same interface.

## Data Model

- `users`: id, email (unique, null for guests), password_hash (null for guests and Google-only users), is_guest, language (`en` or `ar`), email_verified, google_id (unique, null unless linked), token_version (bumped to sign out all sessions), created_at
- `email_tokens`: id, user_id -> users, purpose (`verify` or `reset`), token_hash (SHA-256; the raw token is only in the emailed link), expires_at, used_at
- `boards`: id, owner_id -> users, title, created_at
- `columns`: id, board_id -> boards, title, position
- `cards`: id, column_id -> columns, title, details, completed, priority, due_date, position, created_at
- `checklist_items`: id, card_id -> cards, text, done, position
- `labels`: id, board_id -> boards, name, color
- `card_labels`: card_id -> cards, label_id -> labels
- `attachments`: id, card_id -> cards, owner_id -> users, filename (display only, sanitized), content_type, size, storage_key (random), created_at
- `boards` gains: background_kind (`none`, `preset`, `image`), background_preset, background_key

Authorization rule: a user can only read or change boards they own (and everything under them).

## API (all under `/api`)

- Auth: `POST /auth/signup`, `POST /auth/signin`, `POST /auth/guest`, `POST /auth/upgrade`, `POST /auth/signout`, `GET /auth/me`, `DELETE /auth/me`
- Account security: `GET /auth/google/login`, `GET /auth/google/callback`, `POST /auth/verify`, `POST /auth/resend-verification`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /auth/change-password`
- Boards: `GET /boards`, `POST /boards` (optional `template`), `GET /boards/{id}` (full board), `PATCH /boards/{id}`, `DELETE /boards/{id}`
- Columns: `POST /boards/{id}/columns`, `PATCH /columns/{id}`, `DELETE /columns/{id}`, `POST /boards/{id}/columns/order`
- Cards: `POST /columns/{id}/cards`, `PATCH /cards/{id}`, `DELETE /cards/{id}`, `POST /cards/{id}/move`
- Checklist: `POST /cards/{id}/checklist`, `PATCH /checklist/{id}`, `DELETE /checklist/{id}`
- Labels: `POST /boards/{id}/labels`, `DELETE /labels/{id}`, `PUT /cards/{id}/labels`
- AI: `POST /ai/cards/{id}/checklist`, `POST /ai/boards`, `POST /ai/chat`
- Files: `POST /cards/{id}/attachments` (multipart), `GET /attachments/{id}` (download), `DELETE /attachments/{id}`, `GET /files/usage`
- Background: `PUT /boards/{id}/background` (multipart image), `PUT /boards/{id}/background/preset`, `DELETE /boards/{id}/background`, `GET /boards/{id}/background`

Every request sends `Accept-Language` (`en` or `ar`); server messages, emails, seeded demo boards, templates and AI answers use it. `PATCH /auth/me` saves the signed-in user's language.
Search, filters, undo and keyboard shortcuts run in the browser; no API needed.
Undo: the card or column is hidden at once and the DELETE is sent after 5 seconds unless the user clicks Undo.
Everything else is served from the built frontend (`frontend/dist`), with SPA fallback to `index.html`.

## Account Security Design

Ways in:

| Way in | Flow | Email check |
|--------|------|-------------|
| Continue with Google | Redirect to Google, back to `/api/auth/google/callback`, signed in | Not needed: only Google accounts with `email_verified` are accepted |
| Email + password | Sign up, "check your inbox", click link, verified and signed in | Required before sign-in; "Resend email" available |
| Guest | One click | None; can upgrade later with Google or email + password |

Rules:

- Signing in with Google when a password account already uses that email links the two (Google has proven the email); the account becomes verified.
- Google-only users can add a password through "Forgot password" or "Set password" in the account menu; afterwards both ways work.
- Guest upgrade with Google links the Google account to the guest user; with email + password it sends a verification email and the account stays a guest until verified. Boards are kept either way.
- Forgot password always answers "If an account exists, we sent a link" (no user enumeration). Reset links expire after 30 minutes, verification links after 24 hours; both are single use and stored only as SHA-256 hashes.
- A password reset or change bumps `token_version`, signing out every other session; the JWT carries the version and is rejected when it no longer matches.
- Google sign-in uses Authlib's OpenID Connect client: `state` and PKCE are checked, the ID token signature, issuer, audience and nonce are verified.
- Email links use `APP_URL` (https in production). Emails are plain text plus simple HTML, never containing passwords.
- `EMAIL_MODE=console` (default in development and tests) logs links instead of sending; `EMAIL_MODE=smtp` sends through Gmail SMTP (`smtp.gmail.com:587`, STARTTLS) using `SMTP_USER` and an App Password in `SMTP_PASSWORD`. Gmail allows about 500 emails per day.
- Rate limits: forgot password and resend verification 3 per hour per email and 10 per hour per IP.

Setup needed from the user (free, no billing): a Gmail App Password (requires 2-step verification on that Gmail account), and a Google Cloud OAuth client (consent screen + Web client with the callback URL).

## Languages Design

- Two dictionaries, `en` and `ar`, as typed TypeScript objects: the Arabic one must have every English key (the type checker enforces it) and the same `{placeholders}`.
- A `t(key, params)` function and a `useI18n()` hook; plural messages use `Intl.PluralRules` (Arabic has six plural forms: zero, one, two, few, many, other).
- Dates with `Intl.DateTimeFormat` (Arabic month names); digits are Western 0-9 by default (`ar-u-nu-latn`), switchable to Arabic-Indic digits with one setting.
- Switching language sets `<html lang dir>`; Arabic is `dir="rtl"`. All CSS uses logical properties (`margin-inline-start`, `inset-inline-end`, `text-align: start`) so the layout mirrors by itself; direction icons (chevrons, skip arrows) are mirrored in RTL.
- The choice is saved in the browser (works before sign-in) and on the account (`users.language`), and sent as `Accept-Language` on every request.
- Server: user-facing error messages, verification and reset emails, the demo board and templates exist in both languages; the AI prompts ask for answers in the user's language.
- Arabic font: IBM Plex Sans Arabic (self-hosted with Fontsource; its `unicode-range` means it is only downloaded when Arabic text appears).
- Names the user types (boards, cards, labels) are never translated.

## Files Design

- Storage interface with `put(key, bytes, content_type)`, `get(key)`, `delete(key)`: `LocalStorage` (folder, development and tests) and `S3Storage` (production, added in the deployment phase). Keys are random UUIDs; the user's file name is only stored for display.
- Limits: 4 MB per attachment (Vercel rejects requests over 4.5 MB), 10 attachments per card, 100 MB per account and 10 MB per guest; backgrounds up to 10 MB before shrinking, at most 2 MB stored.
- Allowed attachment types, checked by the file's real content (magic bytes) and extension together: JPG, PNG, WebP, GIF, PDF, TXT, CSV, DOCX, XLSX, PPTX. Never SVG, HTML, scripts or programs.
- Images (backgrounds and image previews) are opened and re-saved with Pillow, which rejects fake images and strips metadata such as GPS location. The browser shrinks backgrounds to at most 2560 px wide (WebP) before upload.
- Downloads go through an owner-checked endpoint with `Content-Disposition: attachment` (images may display inline), the stored content type, `X-Content-Type-Options: nosniff` and a restrictive CSP. No public file links.
- Multipart uploads can be sent cross-site like plain forms, so upload endpoints rely on the Origin check (SEC-33) and get their own rate limit.
- Deleting a card, column, board or account deletes its stored files too.
- Background presets are CSS gradients in the brand colors and need no storage. Over a photo, the board is dimmed slightly and columns keep solid surfaces so cards stay readable.
- Production storage provider (chosen at deployment): Cloudflare R2 (about 10 GB free, no download fees) or Supabase Storage (about 1 GB free; free projects pause after about a week without activity; one account if the database is also Supabase). Both are S3-compatible, so the code is the same.

## Focus Timer Design

- Opt-in: off by default. The board header shows only a "Focus timer" button; turning it on opens the timer panel. "Turn off focus timer" stops and clears the timer and hides it again. The on/off choice is remembered per browser.
- Frontend only; no backend or database changes. State (enabled, mode, phase, end time, paused remaining time) is saved in the browser so it survives reloads.
- Modes: 25 min focus / 5 min break, or 50 min focus / 10 min break.
- Controls: start, pause, reset focus, reset break (each resets only its own phase), skip to break or focus.
- The countdown is computed from a fixed end time, so it stays exact in background tabs and after reloads.
- When focus ends: short chime (Web Audio, can be muted), optional browser notification, break starts. When the break ends, the timer asks before starting the next focus.
- Shown as a chip in the board header with time left (yellow for focus, blue for break) and in the tab title; screen readers hear phase changes, not every second.
- Possible later extension: link the timer to a card and count completed sessions.

## AI Design

- One module `backend/app/ai.py` with a single `complete(messages)` helper calling `litellm.completion` with model `openrouter/nvidia/nemotron-3.5-super-vl:free` and the backup model passed through OpenRouter's `models` fallback list.
- `OPENROUTER_API_KEY` read from the root `.env`. Every call sets `max_tokens` (1500) and a 60s timeout.
- Free-tier limits (OpenRouter docs, checked 2026-10-20): 20 requests per minute and **50 requests per day for the whole account** (1,000 per day after buying 10 credits). The app shows a friendly "AI limit reached for today, try again tomorrow" message on OpenRouter 429, and per-user limits stop one user from using the whole daily quota.
- Answers take about 4-13 seconds, so every AI action shows a clear loading state and can be cancelled.
- Free providers may log prompts. The UI states that AI features send the card or board text to a third-party AI service, and only the needed text is sent.
- Model choice (benchmark 2026-10-20, structured checklist, 2 runs each): Nemotron 3.5 Super 4-13s OK; Nemotron 3 Super 120B 13-42s OK; MiniMax M3.1 Flash broken structured output; Gemma 4 26B/31B and Xing 4.0 rate-limited. Paid options (Cerebras, gpt-oss-120b) were dropped: no credits.
- Checklist generator and board starter ask for JSON output and validate it with Pydantic.
- Chat sends the user's current board (columns, cards with ids, due dates, priorities) plus a short description of the app's features as context; history is kept in the browser and sent with each request.
- Chat replies are JSON: `{"reply": str, "actions": [...]}`. Actions are `create_card`, `move_card`, `complete_card`. The browser shows each action with a Confirm button that calls the normal card endpoints, so no extra write endpoint is needed.
- Unit tests mock `complete`; one live smoke test runs only with `uv run pytest -m live`.

---

## Phase 1 - Scaffolding

- [x] Root `.gitignore` (Python, Node, `.env`, `*.db`, `dist/`, Playwright reports)
- [x] `git init` with first commit
- [x] `backend/` created with `uv init`; FastAPI, SQLModel, pwdlib, PyJWT, LiteLLM, python-dotenv added with `uv add`
- [x] `frontend/` created with Vite React-TS template
- [x] `GET /api/health` returns `{"status": "ok"}`
- [x] `uv run pytest` passes with one health test
- [x] `npm run build` succeeds and FastAPI serves `frontend/dist/index.html` at `/`

## Phase 2 - Database and Models

- [x] SQLModel tables for all models above
- [x] Tables created on startup; DB path configurable for tests
- [x] Seed function creates the demo board: 3 columns, realistic cards, labels, priorities, due dates (one overdue), one checklist
- [x] Board templates (Blank, Sprint, Bug tracking, Personal) defined as data and built by the same seed code
- [x] Unit tests: seed produces 1 board / 3 columns / expected cards; cascade delete removes children

## Phase 3 - Authentication and Authorization

- [x] Sign up, sign in, sign out, `me`
- [x] Guest sign-in creates a guest user with the demo board
- [x] New regular users also get the demo board
- [x] Guest upgrade sets email and password on the guest user, boards kept
- [x] Guest cleanup on startup removes guests older than 7 days
- [x] JWT in httpOnly, SameSite=Lax cookie; `JWT_SECRET` read from `.env`
- [x] Unit tests: signup, duplicate email, wrong password, guest flow, upgrade, cleanup, 401 without cookie

## Phase 4 - Boards, Columns, Cards, Labels API

- [x] Board CRUD; new boards start with the 3 default columns, or the chosen template
- [x] Column add, rename, delete, reorder
- [x] Card create, update (title, details, completed, priority, due_date), delete, move with contiguous positions
- [x] Checklist item create, toggle, rename, delete
- [x] Labels create, delete, set on card
- [x] Unit tests for every endpoint, including: user A cannot access user B's board (404), move and reorder are correct

## Phase 5 - AI Backend

- [x] `ai.py` helper; live smoke test returns a reply from the free model
- [x] OpenRouter 429 and timeouts become friendly messages; backup model used when the main one fails
- [x] `POST /ai/cards/{id}/checklist` returns 3-7 suggested items (not saved until the user accepts)
- [x] `POST /ai/boards` creates a board with columns and cards from a description
- [x] `POST /ai/chat` answers using the current board as context and may return proposed actions
- [x] Unknown action types or card ids not on the board are dropped from the response
- [x] Unit tests with mocked `complete`: valid output, malformed JSON gives a clear 502, authorization enforced

## Phase 6 - Account Security (backend)

- [x] `users` gets `email_verified`, `google_id`, `token_version`; new `email_tokens` table
- [x] Mailer with console and SMTP modes; console mode used by all tests
- [x] Sign up sends a verification email; unverified accounts cannot sign in (clear message plus resend option)
- [x] Verify, resend verification, forgot password, reset password, change password endpoints
- [x] Token versioning: reset or change password signs out other sessions
- [x] Google sign-in (login + callback) with account linking and guest upgrade via Google
- [x] Guest upgrade with email + password requires verification
- [x] Unit tests for every flow, including expired, reused and tampered tokens, enumeration-safe responses, and a faked Google provider
- [ ] Live check: one real verification email sent through Gmail SMTP; one real Google sign-in in the browser (moved to Phase 16 by the user)

## Phase 7 - Frontend Foundation

- [x] Design tokens from the color scheme (accent `#ecad0a`, primary `#209dd7`, secondary `#753991`, navy `#032147`, gray `#888888`), light and dark themes
- [x] Typed API client using `fetch` with cookies
- [x] Auth screen: "Continue with Google" (Google branding guidelines), sign in, sign up, "Continue as guest", "Forgot password?"
- [x] Account pages: check-your-inbox, verify link landing, reset password, change or set password in the account menu
- [x] App shell: header with board switcher, new board, theme toggle, account menu (sign out, upgrade guest)
- [x] Vitest tests: auth form validation, API client error handling, theme toggle

## Phase 8 - Board UI

- [x] Board view renders columns and cards
- [x] Inline column rename, add column, delete column, drag to reorder columns
- [x] Add card, delete card with a 5-second Undo (instead of a confirm step), completed checkbox with muted style
- [x] Card shows priority badge, labels, due date (red when overdue, yellow when due within 2 days), checklist progress
- [x] Board progress bar in the board header
- [x] Card detail modal: title, markdown description (edit and preview), priority, due date, labels, checklist
- [x] Drag and drop cards within and between columns, optimistic update, persisted
- [x] Search box and filters (label, priority, completed) above the board
- [x] Undo toast for card and column delete
- [x] Keyboard shortcuts N, /, Esc, ? with a help dialog
- [x] Vitest tests: card render, modal edits, filtering logic, due-date status, undo timer

## Phase 9 - Files (attachments and board backgrounds)

- [x] Storage interface with local folder implementation; storage folder git-ignored
- [x] `attachments` table and board background fields
- [x] Upload, download, delete attachments with type, size, per-card and per-account limits
- [x] Board background: upload photo, choose preset, remove; image checked and re-saved with Pillow
- [x] Owner checks, safe download headers, files deleted with their card, column, board or account
- [x] Card modal Attachments section: drag and drop or choose files, progress, preview for images, download, delete
- [x] Board menu "Change background": upload (shrunk in the browser first), presets, remove; readable over any photo
- [x] Unit tests for every rule above (backend and frontend)

## Phase 10 - Focus Timer (Pomodoro)

- [x] Timer logic as pure functions computed from a fixed end time
- [x] Opt-in: hidden behind a "Focus timer" button until the user turns it on; "Turn off focus timer" stops, clears and hides it; choice remembered
- [x] Header chip and panel: 25/5 or 50/10, start, pause, reset focus, reset break, skip
- [x] Phase switch with chime (can be muted) and optional notification; tab title shows time left
- [x] State survives reload; screen-reader announcements on phase changes only
- [x] Unit tests for timer logic and controls

## Phase 11 - Languages: English and Arabic

- [ ] i18n core: `en` and `ar` dictionaries (typed, same keys and placeholders), `t()`, `useI18n()`, plural rules, date and number formatting
- [ ] Language button ("العربية" / "English") in the app header and on the sign-in screens; choice saved in the browser and on the account; `<html lang dir>` updated
- [ ] Every existing screen uses `t()`: sign-in and account pages, shell, board, card window, attachments, background picker, focus timer, toasts, shortcuts help
- [ ] Right-to-left layout: CSS converted to logical properties; direction icons mirrored; drag and drop and keyboard moves work in RTL
- [ ] Arabic font (IBM Plex Sans Arabic) self-hosted
- [ ] Backend: `users.language`, `Accept-Language` handling, translated server messages, Arabic verification and reset emails, Arabic demo board and templates
- [ ] AI prompts ask for answers in the user's language (used by Phase 12)
- [ ] Unit tests for every rule above (frontend and backend)
- [ ] Screenshots reviewed in Arabic at 360, 768 and 1440 px in light and dark themes

## Phase 12 - AI UI

- [ ] "Suggest checklist" button in card modal; user picks which items to add
- [ ] New board dialog: Blank, templates, or "Describe it to AI"
- [ ] Chat side panel with message history, loading state, clear button, and Confirm buttons for proposed actions
- [ ] Vitest tests: suggestion selection, chat message rendering

## Phase 13 - Polish

- [ ] Consistent spacing, typography, shadows, hover and focus states in both themes
- [ ] Smooth drag overlay and drop animation
- [ ] Empty states (no cards, no boards, no search results)
- [ ] Enter to save, Escape to cancel/close
- [ ] Responsive layout: columns scroll horizontally on small screens
- [ ] On phones, keep the board menu on the same line as the focus timer (it wraps today)
- [ ] Touch drag and drop on phones and tablets (press and hold to pick up a card, page still scrolls normally)
- [ ] Responsive and theme pass: every feature checked at 360, 768, 1024 and 1440 px, in light and dark themes, in English and Arabic; no page-level horizontal scroll; tap targets at least 40 px on touch screens

## Phase 14 - Security and Non-Functional Hardening

- [ ] Security headers, Origin check, body size limit, TrustedHost, production settings (`ENV=production`)
- [ ] Rate limits on auth, guest and AI endpoints
- [ ] Per-user resource caps
- [ ] Every SEC-xx item in `Planning/SECURITY.md` checked with its test
- [ ] Dependency audits clean; ruff and tsc clean; coverage 90% or more

## Phase 15 - Integration Testing (Playwright)

- [ ] Guest flow: continue as guest, demo board with dummy data visible
- [ ] Sign up, verify email (link read from console mode), sign out, sign in, data persists; guest upgrade keeps boards
- [ ] Forgot password, reset, old password rejected, other session signed out
- [ ] Google sign-in with a faked Google provider in test mode
- [ ] Create board with 3 default columns; rename, add, reorder, delete columns
- [ ] Add card, edit description, due date, labels, checklist, mark completed, delete
- [ ] Drag a card to another column; reload; position persists
- [ ] Search and filters narrow the visible cards
- [ ] Dark mode toggle persists across reload
- [ ] Priority filter, overdue highlight, progress bar, undo delete, keyboard shortcuts, markdown preview
- [ ] Board from template
- [ ] AI: suggest checklist, AI board starter, chat reply, chat action confirmed and applied (live, with key)
- [ ] Two users cannot see each other's boards
- [ ] Switch to Arabic: layout becomes right-to-left, texts are Arabic, choice survives reload and sign-in; emails and AI answers in Arabic
- [ ] Main flows at phone and tablet sizes, including touch drag and drop
- [ ] Upload a board background and see it after reload; remove it
- [ ] Attach a PDF and an image to a card, download them, delete one; an oversized file is refused
- [ ] Focus timer: off by default; turn it on, run it with a fast-forwarded browser clock (focus ends, break starts, reset focus and reset break work, 50/10 mode); turn it off
- [ ] All defects fixed and re-tested

## Phase 16 - Done

- [ ] Live account checks from Phase 6: real Gmail verification email and real Google sign-in
- [ ] Every test in `Planning/TEST_PLAN.md` ticked and passing
- [ ] Every item in `Planning/SECURITY.md` ticked
- [ ] README has run and test instructions
- [ ] Server running locally with the built frontend, ready for the user

## Phase 17 - Deployment (Vercel)

- [ ] Choose Postgres provider (Neon or Supabase); add Postgres driver with `uv add`
- [ ] Full backend test suite passes against Postgres
- [ ] Alembic set up with an initial migration
- [ ] Redis rate-limit store (Upstash) behind the same interface; tests pass for both stores
- [ ] `POST /api/cron/cleanup` protected by `CRON_SECRET`, scheduled in `vercel.json`
- [ ] `vercel.json`: frontend served from Vercel's CDN, `/api/*` routed to FastAPI
- [ ] Test deploy confirms the function bundle (including LiteLLM) fits Vercel's size limit; cold start measured
- [ ] Production environment variables set in Vercel; `ENV=production`, `ALLOWED_HOSTS`, `APP_URL`, `EMAIL_MODE=smtp` set
- [ ] Production callback URL added to the Google OAuth client
- [ ] File storage provider chosen (Cloudflare R2, or Supabase Storage if the database is Supabase); `S3Storage` added with `uv add boto3`; upload, download and delete verified on the deployed URL; uploads stay under Vercel's 4.5 MB limit
- [ ] Playwright smoke suite passes against the deployed URL
- [ ] Security headers, Secure cookie and HSTS verified on the deployed URL
