 Task Manager - Implementation Plan

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
| Phase 6 - Account Security (backend) | 9 / 9 | Done |
| Phase 7 - Frontend Foundation | 6 / 6 | Done |
| Phase 8 - Board UI | 11 / 11 | Done |
| Phase 9 - Files (attachments and board backgrounds) | 8 / 8 | Done |
| Phase 10 - Focus Timer (Pomodoro) | 6 / 6 | Done |
| Phase 11 - Languages: English and Arabic | 9 / 9 | Done |
| Phase 12 - AI UI | 4 / 4 | Done |
| Phase 13 - Polish | 8 / 8 | Done |
| Phase 14 - Security and Non-Functional Hardening | 5 / 5 | Done |
| Phase 15 - Integration Testing (Playwright) | 19 / 19 | Done |
| Phase 16 - Done | 7 / 7 | Done |
| Phase 17 - Password Strength | 7 / 7 | Done |
| Phase 18 - Board Sharing (backend) | 9 / 9 | Done |
| Phase 19 - Board Sharing (UI) | 7 / 7 | Done |
| Phase 20 - Public Boards, Assignment and Meeting Link | 7 / 7 | Done |
| Phase 21 - Voice Input | 7 / 7 | Done |
| Phase 22 - Collaboration: Comments and Activity | 6 / 6 | Done |
| Phase 23 - Notifications and Reminders | 4 / 4 | Done |
| Phase 24 - Organize: Archive, Copies, Templates, Stars, WIP, Auto-complete, Covers, Focus Sessions | 6 / 6 | Done |
| Phase 25 - List View and Export | 3 / 3 | Done |
| Phase 26 - Workspaces, Start Page and Full Regression | 11 / 11 | Done |
| Phase 27 - Voice Commands | 7 / 7 | Done |
| Phase 28 - Deployment (Vercel) | 5 / 14 | In progress |
| Phase 29 - Documentation (Word files) | 0 / 8 | Not started |

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
34. Password strength meter (Weak / Medium / Strong) on every password field; Weak passwords are refused (approved 2026-10-21)
35. Board members: the board's creator is its admin; invite by email (emailed link, plus Copy and Share on WhatsApp); the invitee accepts by signing in with that email (approved 2026-10-21)
36. Member permissions set by the admin in a members panel: Viewer (default), Can update tasks, Full access; one selected per member; a Viewer who tries to edit sees "ask the admin" with a Request access button that emails the admin (approved 2026-10-21)
37. Public boards: anyone with the link can view read-only without signing in; a signed-in visitor can join as a Viewer (approved 2026-10-21)
38. Assign cards to board members; "Assigned to me" filter (approved 2026-10-21)
42. Further features (Phases 22-25, before Deployment; trimmed by the user on 2026-10-21): comments with @mentions, activity log, notifications with emails and a daily reminder, archive and restore, duplicate cards and boards, own templates, starred boards, WIP limits, auto-complete in the last column, card covers, focus sessions on cards, list view, export
41. Project documentation as Word files (Phase 29, after Deployment; requested 2026-10-21)
43. Workspaces that group related boards, a start page after sign-in (left panel with each workspace's boards and members, boards by workspace in the middle, What's new notifications), notifications for invitations and for changes to your assigned cards, and AI-suggested columns from a board's name with no demo cards (Phase 26, before Deployment; requested 2026-10-21)
44. Voice commands: one microphone button that understands spoken commands (add, move, complete, delete, rename, priority, due date, assign, open, search, filters) in English and Arabic, shows each change for Confirm, and sends anything else to the AI chat (Phase 27, before Deployment; approved 2026-10-22)
40. Voice input for people who cannot type: a microphone button on the main text fields and the AI chat, in English and Arabic (approved for planning 2026-10-21; build after the user checks the plan)
39. Meeting link on the board (Zoom, Google Meet, Teams or any https link): Start meeting opens it (Zoom links open the Zoom app); the admin can email the link to all members (approved 2026-10-21)
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
| N12 | Board sharing with members and roles (owner, editor, viewer) | Changes auth model from #2 | Large | Approved 2026-10-21 as #35-#39 (Phases 18-20) |
| N13 | Real-time sync between open browsers | Needs N12 | Large | Not for this version |
| N14 | File attachments on cards | None | Large | Not for this version |

### Deferred on 2026-10-21 (not built; the user can bring any back)

| Feature | Why it was deferred |
|---------|---------------------|
| AI weekly summary | Uses the shared free AI quota (50 requests a day for the whole site); the AI chat can already answer "what changed this week?" |
| Installable app with offline viewing (PWA) | Offline caching of private boards is complex and risky; the site already works in phone browsers |
| Trello import | Few users need it; Trello's export is large and adds an upload path to secure |
| Automation rules | A full rules engine; the common rule (moved to Done marks complete) is covered by auto-complete |
| Swimlanes | Changes the board layout and drag and drop, the most delicate part of the app |
| Live updates every 15 seconds | 240 server calls per hour per open board would use the free hosting allowance; the board already reloads when the tab regains focus |
| Card dependencies, recurring cards | Rarely needed in a simple Kanban app; each adds rules to the card flow |
| Calendar view, board stats | Medium to large work; the list view, filters and export cover most needs |

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

- New in Phase 18: `board_members`: id, board_id -> boards, user_id -> users, role (`admin`, `editor`, `updater`, `viewer`), created_at; unique (board_id, user_id). The board's owner has the `admin` row.
- New in Phase 18: `board_invites`: id, board_id, invited_by -> users, email, token_hash (SHA-256), expires_at, used_at, created_at
- New in Phase 18: `access_requests`: id, board_id, user_id, created_at; one per member per board
- New in Phase 20: `card_assignees`: card_id -> cards, user_id -> users; `public_links`: board_id (unique), token (unique; the board is public while this row exists); `meeting_links`: board_id (unique), url. New tables instead of new `boards` columns, so existing local databases keep working without a reset.

Authorization rule (until Phase 17): a user can only read or change boards they own. From Phase 18: a user can read a board they are a member of and change it as far as their role allows (see Board Sharing Design).

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

- Members (Phase 18): `GET /boards/{id}/members`, `PATCH /boards/{id}/members/{user_id}` (role), `DELETE /boards/{id}/members/{user_id}` (remove, or leave when it is yourself)
- Invites (Phase 18): `POST /boards/{id}/invites`, `POST /invites/{id}/resend` (new link and email; the old link stops working, because only token hashes are stored), `DELETE /invites/{id}`, `POST /invites/preview` (no sign-in), `POST /invites/accept`
- Access requests (Phase 18): `POST /boards/{id}/access-requests`, `POST /access-requests/{id}/approve` (with role), `DELETE /access-requests/{id}` (decline)
- Public boards, assignment, meeting (Phase 20): `PUT /boards/{id}/visibility`, `GET /public/boards/{token}`, `GET /public/boards/{token}/background`, `POST /public/boards/{token}/join`, `PUT /cards/{id}/assignees`, `PUT /boards/{id}/meeting`, `POST /boards/{id}/meeting/email`

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

## Password Strength Design (Phase 17)

Same rules in the browser (live meter) and on the server (the authority). One table of example passwords in `backend/tests/password_cases.json` is checked by both test suites, so they cannot drift.

- Kinds of characters: lowercase, uppercase, digits, symbols.
- **Weak** (refused): fewer than 8 characters; or in the common-password list (case-insensitive); or contains the part of the email before `@` (4+ characters); or fewer than 5 different characters; or not Medium.
- **Medium** (accepted): 10+ characters with 2+ kinds, or 8+ characters with 3+ kinds.
- **Strong** (accepted): 12+ characters with 3+ kinds, or 16+ characters with 2+ kinds.
- Applies to sign up, guest upgrade, reset password, change password and set password. Sign in is unchanged (old passwords keep working).
- Meter under the field: a 3-step bar plus the word (Weak / Medium / Strong) and one hint ("Add numbers or symbols", "Use at least 10 characters"); colors with text, never color alone; announced politely to screen readers; translated.
- Common-password list (about 200 entries) kept in `backend/app/common_passwords.txt` and copied to the frontend; a test checks both copies match.

## Board Sharing Design (Phases 18-20)

Roles (stored per member; the admin chooses exactly one per member in the members panel; new members start as Viewer):

| Action | Viewer | Can update tasks | Full access | Admin |
|--------|--------|------------------|-------------|-------|
| See the board, download attachments, ask the AI chat | Yes | Yes | Yes | Yes |
| Move cards, mark complete, tick checklist items | No | Yes | Yes | Yes |
| Add, edit and delete cards, columns, labels, checklist items, attachments; AI checklist; assign cards | No | No | Yes | Yes |
| Rename or delete the board, background, members, invites, requests, public or private, meeting link | No | No | No | Yes |

- Non-members get 404 (as today). A member without the right permission gets 403 with a translated message: Viewer: "You can only view this board. Ask the board admin for permission to edit."; Can update tasks: "Ask the board admin for full access to do this." The browser shows the same message as a toast with a **Request access** button, before sending anything.
- **Request access** emails the admin ("{email} asks for more access to {board}") with a link that opens the members panel; the request shows there with Approve as Can update tasks / Full access, or Decline. One pending request per member per board.
- **Invite:** the admin types an email. The app emails an invitation link (`/invite#token=...`, one use, 7 days) and shows the same link with Copy and Share on WhatsApp (`https://wa.me/?text=...`). Any address can be invited: the email says to sign in, or create an account, with that address. The app never says whether an address has an account and has no way to search or list users. Accepting needs a signed-in, verified account with the invited email; it adds a Viewer.
- **Members panel** (board menu, "Members"): one row per member (email, initials) with Viewer / Can update tasks / Full access as a single choice (radio group), Remove; the admin row is fixed. Pending invites (Send again, which gives a fresh link to Copy or Share on WhatsApp; Cancel) and access requests below. Members who are not admins see the member list read-only and a Leave board button.
- Guests cannot invite or be invited (no email); a guest admin sees "Create an account to share this board".
- One admin per board (the creator). Deleting the board removes it for everyone; deleting an account removes its boards and memberships. Attachments count against the uploader's storage.
- Board switcher: "Your boards" and "Shared with you". Others' changes appear when the board reloads; the board reloads when the tab regains focus (no live sync, N13 stays deferred).
- Limits: 50 members and 20 pending invites per board; invites 20 per hour per user; access requests 3 per day per member per board; meeting emails 3 per hour per board.
- **Public boards (Phase 20):** the admin switches a board to public and copies its link `/p/{token}` (random token, not the board id; switching back to private revokes it). Anyone with the link sees a read-only board (no attachments, no member emails, no AI), with `X-Robots-Tag: noindex`. A signed-in visitor sees **Join board** and becomes a Viewer.
- **Assignment (Phase 20):** a card can be assigned to any members; their initials show on the card; filter "Assigned to me". Removing a member removes their assignments.
- **Meeting link (Phase 20):** the admin saves an https link; every member sees **Start meeting** (opens a new tab; Zoom links open the Zoom app). **Email the link to members** sends it to everyone on the board. Creating Zoom meetings automatically is out of scope (needs a Zoom developer app and its own sign-in).
- Local database: Phase 20 adds only new tables, so the local `backend/taskmanager.db` keeps working (no reset).

## Voice Input Design (Phase 21)

Goal: someone who cannot type can fill in the app's text fields and drive the board by speaking.

- **Engine:** the browser's built-in speech recognition (Web Speech API, `SpeechRecognition` / `webkitSpeechRecognition`). Free, no API key, no new library, nothing for the server to do. Works in Chrome, Edge and Safari; Firefox has no support, so the microphone button is not shown there.
- **Language:** follows the app language: English `en-US`, Arabic `ar-EG`.
- **Where:** a microphone button inside these fields: new card title (column composer), card title and description, new checklist item, search, new board title and "Describe it to AI", and the AI chat message. Not on email or password fields.
- **How it behaves:** press the button (or Space / Enter on it) to start, speak, press again to stop; it also stops by itself after a pause. Words appear live in the field while speaking (interim results) and the final text is added at the end of what is already there. Nothing is saved or sent until the user saves or sends as usual, so every spoken text can be checked first.
- **Voice commands:** through the existing AI chat: say "add a card Call the supplier to In Progress" or "mark Fix checkout complete" into the chat; the chat proposes the action and the user confirms, as today. No separate command system.
- **Feedback and accessibility:** the button shows a pulsing "listening" state (no animation with reduced motion), has `aria-pressed` and a label ("Start voice input" / "Stop voice input"), and a polite live region announces "Listening" and "Stopped". At least 40 px on touch screens. Works in light and dark, LTR and RTL.
- **Privacy:** the browser sends the audio to its maker's speech service (Google, Microsoft or Apple). The first time someone uses the microphone, a short notice says so (remembered in the browser); the AI chat panel keeps its existing third-party note.
- **Errors (translated):** microphone blocked ("Allow the microphone in your browser to use voice input"), no speech heard, no network.
- **Security headers:** `Permissions-Policy` changes from `microphone=()` to `microphone=(self)` (this site only; camera and geolocation stay off). No CSP change.
- **Tests:** speech is faked in unit tests and in Playwright (an init script installs a fake `SpeechRecognition` that returns chosen words), so tests never need a real microphone.

## Further Features Design (Phases 22-25)

All of these follow the existing rules: membership and role checks on every endpoint (Viewer reads; "Can update tasks" moves, completes and comments; Full access edits; Admin manages), English and Arabic, light and dark, phone to desktop, keyboard and screen readers, optimistic updates, translated server messages. Features deferred on 2026-10-21 are listed under "Deferred" in Scope.

**Database changes from Phase 22 on.** Alembic (planned for Deployment) moves to the start of Phase 22: every later phase adds a migration, so local and production databases update without a reset. Deployment then only runs the migrations against Postgres.

**Phase 22 - Collaboration: comments and activity**
- Comments on cards (`comments`: card, author, text up to 5,000 characters, created, edited). Shown newest last in the card window, written in Markdown with the existing safe renderer. "Can update tasks" and above can comment; Viewers read. Authors edit or delete their own; the admin can delete any.
- @mentions: typing `@` suggests board members; a mention creates a notification (Phase 23).
- Activity log (`activity`: board, card, actor, kind, short summary, time): written by every change (card created, moved, completed, edited, assigned, commented, member joined, and so on). Shown as "History" in the card window and as a board "Activity" panel. The newest 1,000 entries per board are kept.

**Phase 23 - Notifications and reminders**
- Notifications (`notifications`: user, kind, board, card, actor, created, read): assigned to a card, mentioned, a card you are assigned to is due tomorrow or overdue. A bell in the header with an unread count and a list; clicking opens the card; "Mark all as read". The count refreshes when the app loads, when the tab regains focus and after the user's own actions (no timed polling).
- Email: assignment and mention emails right away; a daily reminder email for cards due tomorrow and overdue cards (one email per user per day). Every email has a link to turn emails off; a setting in the account menu (`notification_settings` table).
- The daily job is a plain function `send_reminders()`: run by `POST /api/cron/reminders` (protected by `CRON_SECRET`, scheduled by Vercel Cron at Deployment) or locally with `uv run python -m app.jobs reminders`.

**Phase 24 - Organize: archive, copies, templates, stars, WIP, auto-complete, covers, focus sessions**
- Archive instead of delete: cards and boards get `archived_at`. Archived cards leave the board (and the 100-card limit) and appear in an "Archived" panel with Restore and Delete; archived boards appear under "Archived" in the board switcher. Delete with Undo stays.
- Duplicate a card (title, details, labels, checklist, priority, due date; not comments or files) or a whole board (columns, cards, labels, checklists; not members, comments or files). Board limits apply.
- Save a board as your own template (`user_templates`, up to 20 per user, private); they appear in the New board dialog.
- Star boards (`board_stars`): starred boards come first in the switcher.
- WIP limit per column (`columns.wip_limit`, 1-100, optional): the column count shows "4 / 3" in a warning color when over; it warns, it does not block.
- Auto-complete: a board setting (admin) so moving a card into the last column marks it complete (and moving it out marks it open).
- Card cover: an attached image can be made the card's cover (`cards.cover_attachment_id`), shown at the top of the card.
- Focus sessions on cards: the focus timer can be pointed at a card; each finished focus period is saved (`focus_sessions`: card, user, minutes up to 60) and the card shows "3 focus sessions, 75 min".

**Phase 25 - List view and export**
- View switch in the board header: Board / List (kept in the URL, `?view=`).
- List view: one table of all cards (title, column, priority, due date, assignees, labels, done), sortable, filtered by the same filters; clicking a row opens the card.
- Export: download the board as CSV (opens in Excel) or JSON (any member).
- The full regression of Phases 21-26 runs at the end of Phase 26.

## Workspaces and Start Page Design (Phase 26)

Requested by the user on 2026-10-21 (first as "projects"; renamed "workspaces" and given a left panel the same day). Everything here is on the **start page**, the first page after sign-in; board pages stay as they are. The full regression runs at the end of this phase, right before Deployment.

- **Workspace:** a named group of related boards (`workspaces`: owner, name up to 100 characters, created; `boards.workspace_id`, optional, so a board is in at most one workspace). Private to the owner, up to 20 each. A board shared with you shows under "Shared with you", never inside someone else's workspace. Deleting a workspace keeps its boards: they move to "Boards without a workspace".
- **Start page** (`/` with no board chosen), shown after sign-in and from an "All boards" button in the header. A new guest or a just-verified account still opens its demo board (the original requirement); the start page is one click away.
  - **Left panel:** each workspace by name with two buttons: **Boards** (expands the list of its boards; choosing one opens it) and **Members** (everyone on the workspace's boards, grouped by board with their permission). Below: "Boards without a workspace" and "Shared with you", each with the same Boards button (and Members for your own boards). "New workspace" at the bottom. On phones and tablets the panel opens from a menu button and closes after a choice.
  - **Middle:** the two start cards ("New workspace", "New board") with their explanations; a **What's new** strip with the latest notifications (unread first, up to 5, each opens its board or card; "See all" opens the bell list); Starred; each workspace as a heading with its board tiles (name, progress); then "Boards without a workspace"; then "Shared with you"; Archived folded at the bottom.
  - **Empty account:** only the two start cards with their explanations.
- **Messages that tell the two apart** (start cards and dialogs):
  - New workspace: "A workspace groups related boards. For example, "Website relaunch" with boards for Design, Development and Marketing."
  - New board: "A board is one stream of work, with columns and cards. Keep it on its own or add it to a workspace."
  - Before creating a workspace: "Creates the workspace "{name}" with {count} boards." (singular and plural, English and Arabic)
- **New workspace dialog:** workspace name, then board names ("Add another board", up to 10). "Suggest columns with AI" fills an editable list of column names for every board in one AI request. Every board starts with its columns and no cards. Without AI each board starts with To Do, In Progress, Done and a short note says so.
- **New board dialog:** Blank shows the column chips, "Suggest columns with AI" from the name, and a Workspace select. Templates and "Describe it to AI" stay.
- **Move to workspace:** board menu item for the board's admin.
- **Notifications (extends Phase 23), shown in the bell and in What's new:**
  - `invited`: someone invited you to a board (when your account exists); opens the invitation. The email stays.
  - `card_changed`: someone else moved, completed, reopened, edited, commented on or changed the due date of a card you are assigned to. In the app only (no email, to avoid noise); one entry per card and person within 10 minutes; never for your own changes.
- **AI column suggestion:** `POST /api/ai/columns` with up to 10 board names and the workspace name; 3 to 8 plain column names per board, at most 40 characters, in the user's language, never cards; `max_tokens` set; AI rate limits and the free-tier fallback apply.
- **Board switcher:** grouped by workspace (Starred first, archived last).
- **API:** `GET/POST /api/workspaces` (POST takes the name and up to 10 boards, each with 1 to 20 columns), `PATCH/DELETE /api/workspaces/{id}`, `GET /api/workspaces/{id}/members` and `GET /api/workspaces/none/members` (your boards without a workspace) listing members per board (owner only), `POST /api/boards` takes `columns` and `workspace_id`, `PATCH /api/boards/{id}` takes `workspace_id`, `BoardSummary` and `BoardOut` gain `workspace_id` (own workspaces only), `cards` and `done`.

## Voice Commands Design (Phase 27)

Requested by the user on 2026-10-22 ("plan it"), after Voice Input (Phase 21). Choices made by the user: common commands are understood in the browser with the AI as a fallback; a change is shown first and done only after Confirm. **Approved by the user on 2026-10-22.**

- **One button:** "Voice command" (microphone with a spark) in the board header and on the start page, and the shortcut **V**. It listens in the app's language (English or Arabic), shows the words live in a small panel, then shows what it understood.
- **What happens next:**
  - **Changes** (add, move, complete, reopen, delete, rename, priority, due date, assign, add column) are shown as a sentence, e.g. "Add card 'Buy domain' to To Do", with **Confirm** and **Cancel**. Delete keeps its Undo after Confirm.
  - **Look-ups** (open a card or board, search, filters, "All boards", help) happen at once.
  - **Several possible matches** ("move design to done" with two "Design ..." cards): it lists them as buttons to choose from.
  - **Not understood:** the words go to the AI chat panel (it opens and sends them), which answers or proposes actions with its own Confirm. This uses the free AI quota, so only phrases of two words or more are sent; a "What can I say?" link is always shown.
- **Commands understood in the browser** (each in English and Arabic; the column, card, board or member is matched by name, ignoring case, punctuation and Arabic letter forms):

| Command | English example | Arabic example |
|---|---|---|
| Add a card | "add card Buy domain to To Do" (no column: the first one) | "أضف بطاقة شراء النطاق إلى المطلوب" |
| Move a card | "move Buy domain to Done" | "انقل شراء النطاق إلى تم" |
| Complete / reopen | "complete Buy domain", "reopen Buy domain" | "أنجز شراء النطاق"، "أعد فتح شراء النطاق" |
| Delete a card | "delete Buy domain" | "احذف شراء النطاق" |
| Rename a card | "rename Buy domain to Buy the domain" | "غيّر اسم شراء النطاق إلى شراء الدومين" |
| Priority | "set Buy domain priority to high" | "اجعل أولوية شراء النطاق عالية" |
| Due date | "Buy domain due tomorrow" (today, tomorrow, next week, a weekday) | "موعد شراء النطاق غدا" |
| Assign | "assign Buy domain to me" / "to sara@..." | "أسند شراء النطاق إلي" |
| Add a column | "add column Review" | "أضف عمود المراجعة" |
| Open | "open Buy domain", "open board Launch", "all boards" | "افتح شراء النطاق"، "افتح لوحة الإطلاق"، "كل اللوحات" |
| Search and filters | "search domain", "show my cards", "show overdue", "show urgent", "show completed", "clear filters" | "ابحث عن النطاق"، "اعرض بطاقاتي"، "اعرض المتأخرة"، "امسح الفلاتر" |
| Help | "what can I say" | "ماذا يمكنني أن أقول" |

- **Permissions:** the same as the buttons: a Viewer can open, search and filter; "Can update tasks" can also move, complete and reopen; Full access can do everything else. A refused command says whom to ask, like the buttons.
- **Privacy:** the speech is turned into text by the browser's speech service (the same notice as voice input); the app's server only ever receives text, and only for a confirmed change or the AI fallback. No audio is stored.
- **Accessibility:** the panel is a labeled region with live announcements; Confirm and Cancel work with the keyboard (Enter, Escape); every command also has an on-screen button elsewhere, so voice is never the only way.
- **Non-goals:** spoken replies (the answer is shown as text), always-on listening or a wake word, commands while a card window is open (the card's own microphone buttons cover that).

## Documentation Design (Phase 29)

Eight Word (`.docx`) files in a new `Documentation/` folder, written after Deployment so they describe the finished, live app (real address, final features, final test results). English, the app's name "Task Manager" on every title page, consistent styling (title page, table of contents for long files, headings, page numbers), the project colors from `CLAUDE.md`, and no secrets (no `.env` values, keys, passwords or personal emails).

| # | File | Contents |
|---|------|----------|
| 1 | `01_Overview.docx` | App name, a short description (one or two sentences) and a long description (about one page) |
| 2 | `02_Documentation.docx` | What the app is for, target audience, every feature grouped by area (boards and cards, sharing and permissions, public boards, AI, files, focus timer, languages, voice input, accounts and security), how to use each one, limits, supported browsers and devices |
| 3 | `03_Test_Plan.docx` | Testing approach (unit, integration, end-to-end, accessibility, performance, security), every test from `TEST_PLAN.md` with its ID and status, every test file with what it covers, how to run the tests, and the final results (counts, coverage, Lighthouse) |
| 4 | `04_Project_Plan.docx` | `PLAN.md` as a document: scope, stack, design sections, data model, API, every phase with its tasks and status |
| 5 | `05_Security.docx` | `SECURITY.md` as a document: every security and non-functional item with its ID, how it is met, and how it is tested |
| 6 | `06_User_Flows.docx` | Step-by-step flows with simple diagrams: guest start, sign up and verify, Google sign-in, forgot password, create a board, cards and drag and drop, invite and accept, permissions and request access, public board and join, assign cards, meeting link, AI chat actions, voice input, files, focus timer, language switch, delete account |
| 7 | `07_Pages.docx` | Every page and main window of the app with a screenshot (light theme, desktop; phone and Arabic examples) and what each part does |
| 8 | `08_Build_Prompts.docx` | Only the phases, each written as a ready-to-use prompt for an AI coding assistant to rebuild the project from scratch (goal, requirements, tasks, success criteria, tests) |

How they are made: a script in `Documentation/build/` (run with `uv run`) reads `PLAN.md`, `TEST_PLAN.md`, `SECURITY.md` and the test files, and writes the Word files with `python-docx`; screenshots and flow diagrams are made with Playwright against the running app. Re-running the script refreshes the documents.

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
- [x] Live check: one real verification email sent through Gmail SMTP; one real Google sign-in in the browser (done in Phase 16, where it is repeated)

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

- [x] i18n core: `en` and `ar` dictionaries (typed, same keys and placeholders), `t()`, `useI18n()`, plural rules, date and number formatting
- [x] Language button ("العربية" / "English") in the app header and on the sign-in screens; choice saved in the browser and on the account; `<html lang dir>` updated
- [x] Every existing screen uses `t()`: sign-in and account pages, shell, board, card window, attachments, background picker, focus timer, toasts, shortcuts help
- [x] Right-to-left layout: CSS converted to logical properties; direction icons mirrored; drag and drop and keyboard moves work in RTL
- [x] Arabic font (IBM Plex Sans Arabic) self-hosted
- [x] Backend: `users.language`, `Accept-Language` handling, translated server messages, Arabic verification and reset emails, Arabic demo board and templates
- [x] AI prompts ask for answers in the user's language (used by Phase 12)
- [x] Unit tests for every rule above (frontend and backend)
- [x] Screenshots reviewed in Arabic at 360, 768 and 1440 px in light and dark themes

## Phase 12 - AI UI

- [x] "Suggest checklist" button in card modal; user picks which items to add
- [x] New board dialog: Blank, templates, or "Describe it to AI"
- [x] Chat side panel with message history, loading state, clear button, and Confirm buttons for proposed actions
- [x] Vitest tests: suggestion selection, chat message rendering

## Phase 13 - Polish

- [x] Consistent spacing, typography, shadows, hover and focus states in both themes
- [x] Smooth drag overlay and drop animation
- [x] Empty states (no cards, no boards, no search results)
- [x] Enter to save, Escape to cancel/close
- [x] Responsive layout: columns scroll horizontally on small screens
- [x] On phones, keep the board menu on the same line as the focus timer (it wraps today)
- [x] Touch drag and drop on phones and tablets (press and hold to pick up a card, page still scrolls normally)
- [x] Responsive and theme pass: every feature checked at 360, 768, 1024 and 1440 px, in light and dark themes, in English and Arabic; no page-level horizontal scroll; tap targets at least 40 px on touch screens

## Phase 14 - Security and Non-Functional Hardening

- [x] Security headers, Origin check, body size limit, TrustedHost, production settings (`ENV=production`)
- [x] Rate limits on auth, guest and AI endpoints
- [x] Per-user resource caps
- [x] Every SEC-xx item in `Planning/SECURITY.md` checked with its test
- [x] Dependency audits clean; ruff and tsc clean; coverage 90% or more

## Phase 15 - Integration Testing (Playwright)

- [x] Guest flow: continue as guest, demo board with dummy data visible
- [x] Sign up, verify email (link read from console mode), sign out, sign in, data persists; guest upgrade keeps boards
- [x] Forgot password, reset, old password rejected, other session signed out
- [x] Google sign-in with a faked Google provider in test mode
- [x] Create board with 3 default columns; rename, add, reorder, delete columns
- [x] Add card, edit description, due date, labels, checklist, mark completed, delete
- [x] Drag a card to another column; reload; position persists
- [x] Search and filters narrow the visible cards
- [x] Dark mode toggle persists across reload
- [x] Priority filter, overdue highlight, progress bar, undo delete, keyboard shortcuts, markdown preview
- [x] Board from template
- [x] AI: suggest checklist, AI board starter, chat reply, chat action confirmed and applied (live, with key)
- [x] Two users cannot see each other's boards
- [x] Switch to Arabic: layout becomes right-to-left, texts are Arabic, choice survives reload and sign-in; emails and AI answers in Arabic
- [x] Main flows at phone and tablet sizes, including touch drag and drop
- [x] Upload a board background and see it after reload; remove it
- [x] Attach a PDF and an image to a card, download them, delete one; an oversized file is refused
- [x] Focus timer: off by default; turn it on, run it with a fast-forwarded browser clock (focus ends, break starts, reset focus and reset break work, 50/10 mode); turn it off
- [x] All defects fixed and re-tested

## Phase 16 - Done

- [x] Live account checks from Phase 6: real Gmail verification email and real Google sign-in
- [x] Every test in `Planning/TEST_PLAN.md` ticked and passing
- [x] Every item in `Planning/SECURITY.md` ticked
- [x] README has run and test instructions
- [x] Server running locally with the built frontend, ready for the user
- [x] Card limit: at most 100 cards per board with a clear message (approved by the user on 2026-10-21; resolves NFR-03)
- [x] Lighthouse: performance 90 or more, accessibility 100 (static assets gzipped and cached)

## Phase 17 - Password Strength

- [x] Shared rules and example table (`password_cases.json`), common-password list in backend and frontend with a match test
- [x] Server refuses Weak passwords on sign up, guest upgrade, reset, change and set password, with a translated message
- [x] Strength meter component (bar, word, hint; accessible; translated; RTL; dark mode) on every password field
- [x] A Weak password shows the reason before any request is sent
- [x] "Continue with Google" shows on sign in, sign up and guest upgrade when Google is configured (checked in the browser)
- [x] Tests T-500 to T-509 pass; SEC-150 to SEC-152 ticked; existing tests updated to strong passwords
- [x] Browser review: phone and desktop, light and dark, English and Arabic

## Phase 18 - Board Sharing (backend)

- [x] `board_members`, `board_invites`, `access_requests` tables; existing boards get their owner as admin (on startup, idempotent)
- [x] One access helper replaces the owner checks: membership (404 otherwise) plus the role needed by each endpoint (403 with message)
- [x] Every existing endpoint mapped to a required role and tested for each role (permission table in the design)
- [x] Invites: create (email + link), preview, accept (matching verified email), cancel, expiry, single use
- [x] Members: list, change role (admin only, admin row fixed), remove, leave
- [x] Access requests: create (emails the admin), approve with role, decline
- [x] `GET /boards` returns owned and shared boards with the user's role; limits and rate limits
- [x] Emails (invite, access request) in English and Arabic
- [x] Tests T-510 to T-539 pass; SEC-160 to SEC-169 ticked (SEC-164 and SEC-168 are finished in Phase 20)

## Phase 19 - Board Sharing (UI)

- [x] Members panel: member rows with a single-choice permission (Viewer / Can update tasks / Full access), Remove, pending invites, access requests
- [x] Invite dialog: email field, sends the invite, shows the link with Copy and Share on WhatsApp
- [x] Invite page `/invite`: shows board and inviter, Accept (sign in or sign up first when needed), clear errors (expired, used, other email)
- [x] The board follows the user's role: blocked actions show the "ask the admin" toast with Request access; drag is refused for Viewers with the same message
- [x] Board switcher: "Your boards" and "Shared with you"; Leave board; board reloads when the tab regains focus
- [x] Tests T-540 to T-559 pass (unit and Playwright: two users, invite, accept, permissions, request access)
- [x] Browser review: phone and desktop, light and dark, English and Arabic

## Phase 20 - Public Boards, Assignment and Meeting Link

- [x] New tables only (`card_assignees`, `public_links`, `meeting_links`), so the local database needs no reset
- [x] Public or private switch (admin), public link with Copy, read-only public page `/p/{token}`, Join board for signed-in visitors
- [x] Card assignees: picker in the card window, initials on cards, "Assigned to me" filter
- [x] Meeting link: admin sets it; Start meeting for every member; Email the link to members
- [x] Tests T-560 to T-589 pass; SEC-170 to SEC-174 ticked
- [x] Full regression: backend, frontend, Playwright (all browsers), Lighthouse, audits
- [x] Browser review: phone and desktop, light and dark, English and Arabic

## Phase 21 - Voice Input

- [x] `useSpeech` hook (start, stop, interim and final text, errors, language) and a `MicButton` component; hidden when the browser has no speech recognition
- [x] Microphone in the column composer, card title and description, checklist item, search, new board title, "Describe it to AI" and the AI chat message
- [x] One-time privacy notice, listening state, live-region announcements, translated errors, reduced motion, 40 px touch target, RTL
- [x] `Permissions-Policy: microphone=(self)` on the server; camera and geolocation stay blocked
- [x] Tests T-600 to T-614 pass; SEC-180 to SEC-183 ticked
- [x] Browser review: phone and desktop, light and dark, English and Arabic
- [x] Real check by the user in Edge or Chrome with a microphone

## Phase 22 - Collaboration: Comments and Activity

- [x] Alembic set up (moved from Deployment) with a baseline migration of the current tables; startup runs migrations; the local database upgrades without a reset
- [x] Comments: model, API (list, add, edit own, delete own or as admin), Markdown, permissions
- [x] @mentions with member suggestions while typing
- [x] Activity log written by every change; card "History" and board "Activity" panel; newest 1,000 kept per board
- [x] UI in both languages, phone to desktop, light and dark
- [x] Tests T-640 to T-655 pass; SEC-200, SEC-201, SEC-205 ticked

## Phase 23 - Notifications and Reminders

- [x] Notifications model and API; header bell with unread count (refreshed on load, focus and own actions), list, open card, mark all read
- [x] Emails for assignment and mention; daily reminder email; turn-off link and account setting
- [x] `send_reminders()` job, `POST /api/cron/reminders` with `CRON_SECRET`, `uv run python -m app.jobs reminders`
- [x] Tests T-660 to T-675 pass; SEC-202 to SEC-204 ticked

## Phase 24 - Organize: Archive, Copies, Templates, Stars, WIP, Auto-complete, Covers, Focus Sessions

- [x] Archive and restore cards and boards; Archived panel and switcher section
- [x] Duplicate card and board; save board as own template; templates in the New board dialog
- [x] Starred boards first in the switcher
- [x] WIP limit per column with warning; auto-complete setting for the last column; card cover image
- [x] Focus sessions linked to cards and shown on cards
- [x] Tests T-680 to T-698 pass; SEC-207, SEC-214 ticked

## Phase 25 - List View and Export

- [x] Board / List switch (URL `?view=`); list view sortable and filtered
- [x] Export CSV and JSON
- [x] Tests T-700 to T-713 pass; SEC-208 ticked

## Phase 26 - Workspaces, Start Page and Full Regression

- [x] `workspaces` table and `boards.workspace_id` with a migration; workspace API with ownership checks; workspace members list
- [x] Boards created with chosen columns and no cards; boards move into and out of workspaces
- [x] AI column suggestion endpoint with validation and fallback
- [x] Start page: left panel (workspaces with Boards and Members, boards without a workspace, shared), middle (start cards, What's new, boards by workspace, then boards without a workspace); empty state with only the two start cards
- [x] New workspace dialog (several boards, AI columns, summary message) and New board dialog (AI columns, workspace)
- [x] Notifications for invitations and for changes to cards assigned to you; What's new on the start page
- [x] Board switcher grouped by workspace; "Move to workspace" in the board menu
- [x] Fixes from the user's check on 2026-10-21: messages and Undo work inside open windows (voice errors were hidden), clear blocked-microphone message, Move left / Move right for columns, archive a whole column, labeled Board options button, clearer Board / List switch, saved templates on the start page, "Sign up to save your boards"; the running server is restarted after every phase (it was still on pre-Phase 23 code, which is why export, auto-complete and archive failed)
- [x] Fixes from the user's second check on 2026-10-22: a failed email no longer leaves a half-made account; guests start with columns only; sign-up asks for the password twice; voice drops trailing punctuation and replaces one-line fields; the Excel download is laid out like the board; columns drag by their header and stack/wrap on smaller screens; bold "..." board options and a Share button; delete a board from the start page
- [x] Full regression after Phases 21-26 (backend, frontend, Playwright in all browsers, axe, Lighthouse, audits)
- [x] Tests T-714, T-720 to T-745 and T-750 to T-757 pass; SEC-215 to SEC-217 ticked

## Phase 27 - Voice Commands

- [x] Command parser in the browser (English and Arabic) with name matching for cards, columns, boards and members; unit tested phrase by phrase
- [x] Voice command button and panel (board header, start page, shortcut V): live words, understood command, Confirm / Cancel, choose among several matches, help list
- [x] Changes run through the existing board actions (same permissions, optimistic updates, Undo for delete); look-ups run at once
- [x] AI fallback: phrases not understood go to the AI chat panel
- [x] English and Arabic, right to left, light and dark, phone to desktop, keyboard and screen reader
- [x] Tests T-780 to T-794 pass; SEC-218 and SEC-219 ticked; full regression
- [x] Fixes from the user's third check on 2026-10-22: the focus timer's card list stays inside its panel; every sign-in (email link, Google, guest) opens the start page; new accounts start with empty To Do / In Progress / Done columns; the Task Manager name opens the start page; saved templates can be deleted from the start page; sending the meeting link also notifies each member (T-800 to T-805)

## Phase 28 - Deployment (Vercel)

- [x] FIRST TASK (remind the user, do it only with their OK): delete the local test data `backend/taskmanager.db` and `backend/storage/`
- [x] Gmail for the app's emails: the user keeps their current Gmail (App Password), decided 2026-10-22
- [x] Postgres provider: Supabase (project in eu-west-1, RLS on for every table, Data API unused); `psycopg[binary]` added with `uv add`; `postgresql://` addresses use the psycopg 3 driver
- [ ] Full backend test suite passes against Postgres
- [ ] Alembic migrations (set up in Phase 22) run against Postgres
- [x] Rate-limit counters shared by every server instance: kept in the Supabase database (`rate_counts` table, migration 0007; the user chose this over Upstash Redis on 2026-10-22); memory store on SQLite; on Vercel the visitor's IP comes from `x-real-ip`
- [x] `GET /api/cron/cleanup` (old guests, ended counters) and `GET /api/cron/reminders` protected by `CRON_SECRET`, scheduled daily in `backend/vercel.json` (Vercel Cron calls with GET)
- [ ] Vercel project with Root Directory `backend`: the build step makes the website into `backend/frontend_dist` and FastAPI serves it with its security headers (Vercel keeps static files in the function when the app has middleware); region `dub1` next to the database
- [ ] Test deploy confirms the function bundle (including LiteLLM) fits Vercel's size limit; cold start measured
- [ ] Production environment variables set in Vercel; `ENV=production`, `ALLOWED_HOSTS`, `APP_URL`, `EMAIL_MODE=smtp` set
- [ ] Production callback URL added to the Google OAuth client
- [ ] File storage provider chosen (Cloudflare R2, or Supabase Storage if the database is Supabase); `S3Storage` added with `uv add boto3`; upload, download and delete verified on the deployed URL; uploads stay under Vercel's 4.5 MB limit
- [ ] Playwright smoke suite passes against the deployed URL
- [ ] Security headers, Secure cookie and HSTS verified on the deployed URL

## Phase 29 - Documentation (Word files)

- [ ] `Documentation/build/` script with shared styles (title page, contents, headings, page numbers, colors)
- [ ] `01_Overview.docx`: name, short and long description
- [ ] `02_Documentation.docx`: features, target audience, how to use, limits, browsers and devices
- [ ] `03_Test_Plan.docx`: approach, all tests with status, all test files, how to run, final results
- [ ] `04_Project_Plan.docx` from `PLAN.md` and `05_Security.docx` from `SECURITY.md`
- [ ] `06_User_Flows.docx` with flow diagrams and `07_Pages.docx` with screenshots
- [ ] `08_Build_Prompts.docx`: every phase as a prompt
- [ ] Tests T-620 to T-627 pass; every file opened and checked by the user
