# Test Plan

All tests are written before or with the code they cover (test first). Tick a test only when it exists and passes.
Security IDs (SEC-xx) and non-functional IDs (NFR-xx) refer to `Planning/SECURITY.md`.

Tools: `pytest` + `TestClient` (backend unit), `vitest` + Testing Library (frontend unit), Playwright + `@axe-core/playwright` (end to end).

## A. Backend unit tests (`backend/tests/`)

### A1. App and health
- [x] T-001 `GET /api/health` returns 200 with app and database status (NFR-30)
- [x] T-002 Unknown `/api/*` path returns JSON 404, not the SPA page
- [x] T-003 Non-API path returns `index.html` (SPA fallback)
- [ ] T-004 Unhandled error returns generic 500 JSON without a stack trace (SEC-93)
- [ ] T-005 `/docs` and `/openapi.json` return 404 when `ENV=production` (SEC-91)
- [x] T-006 App fails to start when `JWT_SECRET` is missing (SEC-04)

### A2. Models and seed
- [x] T-010 Seed creates 1 board, 3 columns (To Do, In Progress, Done), expected cards, labels, one checklist, one overdue card
- [x] T-011 Each template (Blank, Sprint, Bug tracking, Personal) builds the expected columns and cards
- [x] T-012 Deleting a board removes its columns, cards, checklist items, labels and card labels (SEC-100)
- [x] T-013 SQLite foreign keys and WAL mode are on (SEC-103)

### A3. Authentication
- [x] T-020 Sign up creates user, sets cookie, seeds demo board
- [x] T-021 Sign up with existing email returns 409
- [x] T-022 Sign up rejects invalid email, password under 8 or over 128 characters (SEC-02)
- [x] T-023 Email is stored lower-cased; sign in is case-insensitive
- [x] T-024 Password stored as Argon2 hash, not plain text (SEC-01)
- [x] T-025 Sign in with correct password sets cookie
- [x] T-026 Unknown email and wrong password return the same 401 message (SEC-03)
- [x] T-027 Guest sign-in creates guest user with demo board
- [x] T-028 `GET /auth/me` returns the user; without cookie returns 401
- [x] T-029 Expired token returns 401 (SEC-05)
- [x] T-030 Tampered token and `alg: none` token return 401 (SEC-05, SEC-06)
- [x] T-031 Sign out clears the cookie (SEC-07)
- [x] T-032 Cookie flags: HttpOnly, SameSite=Lax, Path=/; Secure in production (SEC-10, SEC-11)
- [x] T-033 No response body contains the token (SEC-12)
- [x] T-034 Guest upgrade sets email and password and keeps boards
- [x] T-035 Upgrade from a regular account returns 400; upgrade to a taken email returns 409 (SEC-08)
- [x] T-036 Guest cleanup removes guests older than 7 days with their data, keeps newer guests and regular users (SEC-102)
- [x] T-037 Delete account removes the user and all their data (SEC-101)

### A4. Boards
- [ ] T-040 List returns only the current user's boards
- [ ] T-041 Create board gives 3 default columns
- [ ] T-042 Create board with a template gives the template's columns and cards
- [ ] T-043 Unknown template name returns 422 (SEC-41)
- [ ] T-044 Get full board returns columns, cards, checklists and labels in position order
- [ ] T-045 Rename and delete board
- [ ] T-046 51st board returns 400 (SEC-42)

### A5. Columns
- [ ] T-050 Add column appends at the end
- [ ] T-051 Rename column
- [ ] T-052 Delete column removes its cards; remaining positions stay contiguous
- [ ] T-053 Reorder columns saves the new order; an order list that is not exactly the board's column ids returns 400
- [ ] T-054 21st column returns 400 (SEC-42)

### A6. Cards
- [ ] T-060 Create card at the end of a column with default priority Medium
- [ ] T-061 Update title, details, completed, priority, due date
- [ ] T-062 Invalid priority returns 422 (SEC-41)
- [ ] T-063 Delete card removes its checklist items and label links
- [ ] T-064 Move within a column reorders positions correctly
- [ ] T-065 Move to another column at a position; both columns stay contiguous
- [ ] T-066 Move to a position past the end puts the card last
- [ ] T-067 501st card on a board returns 400 (SEC-42)

### A7. Checklist and labels
- [ ] T-070 Add, rename, toggle and delete checklist items
- [ ] T-071 51st checklist item returns 400 (SEC-42)
- [ ] T-072 Create and delete labels; deleting a label removes it from cards
- [ ] T-073 Set card labels replaces the full set
- [ ] T-074 Invalid label color returns 422 (SEC-41)

### A8. Authorization (run for every resource type)
- [ ] T-080 User B gets 404 on user A's board, column, card, checklist item and label, for every method (SEC-20, SEC-21)
- [ ] T-081 Moving a card into another user's column returns 404 (SEC-22)
- [ ] T-082 Using another board's label on a card returns 404 (SEC-23)
- [ ] T-083 AI endpoints return 404 for another user's card or board (SEC-24)
- [ ] T-084 Every non-auth endpoint returns 401 without a cookie

### A9. CSRF and input limits
- [ ] T-090 POST with a foreign `Origin` header returns 403 (SEC-33)
- [ ] T-091 Form-encoded body on a JSON endpoint returns 422 (SEC-31)
- [ ] T-092 Strings over their `max_length` return 422 for every field (SEC-40)
- [ ] T-093 Body over 1 MB returns 413 (SEC-43)
- [ ] T-094 SQL-like input (`'; DROP TABLE cards;--`) is stored as plain text (SEC-44)

### A10. Rate limits
- [ ] T-100 11th sign-in within a minute from one IP returns 429 (SEC-50)
- [ ] T-101 6th guest creation within an hour returns 429 (SEC-51)
- [ ] T-102 21st AI call within a minute returns 429 (SEC-52)

### A11. AI (model call mocked)
- [ ] T-110 Checklist suggestion returns 3 to 7 items and saves nothing
- [ ] T-111 Board starter creates a board with the returned columns and cards
- [ ] T-112 Malformed model JSON returns a friendly 502 (SEC-74)
- [ ] T-113 Model timeout or error returns a friendly 502 without provider details (SEC-74)
- [ ] T-114 Chat sends the board as context and returns the reply
- [ ] T-115 Chat actions with valid card and column ids are returned
- [ ] T-116 Chat actions with unknown types or ids from other boards are dropped (SEC-72)
- [ ] T-117 Only the last 20 messages are sent and `max_tokens` is set (SEC-73)
- [ ] T-118 System prompt marks board content as data (SEC-75)
- [ ] T-119 Model is `openrouter/openai/gpt-oss-120b` with Cerebras provider routing
- [ ] T-120 Live smoke test (runs only when `OPENROUTER_API_KEY` is set): a real reply comes back

### A12. Security headers
- [ ] T-130 CSP, nosniff, Referrer-Policy and Permissions-Policy headers on HTML and API responses (SEC-80, SEC-81)
- [ ] T-131 HSTS only when `ENV=production` (SEC-82)
- [ ] T-132 Request with an untrusted Host header is rejected in production (SEC-92)

## B. Frontend unit tests (`frontend/src/**/*.test.tsx`)

- [ ] T-200 API client sends credentials and JSON; turns error responses into readable messages
- [ ] T-201 API client shows a specific message for 429
- [ ] T-202 Auth form: validates email and password length; switches between sign in and sign up
- [ ] T-203 Theme toggle switches theme and saves the choice
- [ ] T-204 Card shows title, priority badge, labels, due date, checklist progress
- [ ] T-205 Due-date status: overdue, due within 2 days, later, completed (no warning)
- [ ] T-206 Filter logic: text search, label, priority, completed, combined
- [ ] T-207 Board progress percentage, including an empty board
- [ ] T-208 Card modal saves title, description, priority, due date
- [ ] T-209 Markdown preview renders headings and lists; raw HTML is shown as text; `javascript:` links removed (SEC-61)
- [ ] T-210 Undo toast: delete is sent after 5 seconds; Undo cancels it
- [ ] T-211 Keyboard shortcuts: N opens new card input, / focuses search, ? opens help, Esc closes; ignored while typing in an input
- [ ] T-212 AI checklist suggestions: user selects items; only selected items are added
- [ ] T-213 Chat panel renders messages, loading state, and Confirm buttons for actions
- [ ] T-214 Confirming a chat action calls the matching card endpoint
- [ ] T-215 Optimistic move rolls back and shows an error when the API fails (NFR-31)
- [ ] T-216 No `dangerouslySetInnerHTML` in the source (checked by a grep test) (SEC-60)

## C. End-to-end tests (Playwright, `frontend/e2e/`)

### C1. Functional
- [ ] T-300 Continue as guest shows the demo board with dummy data
- [ ] T-301 Sign up, sign out, sign in again; data persists
- [ ] T-302 Guest upgrade keeps boards and allows sign in with the new email
- [ ] T-303 Create a blank board with 3 columns; create a board from each template
- [ ] T-304 Rename, add, reorder (drag) and delete columns; undo column delete
- [ ] T-305 Add a card; mark it completed; delete it; undo; delete again and let it expire
- [ ] T-306 Open a card; edit description in markdown and preview; set priority, due date, labels; add, tick and delete checklist items
- [ ] T-307 Drag a card to another column and within a column; reload; order persists
- [ ] T-308 Move a card with the keyboard only (NFR-11)
- [ ] T-309 Search and each filter narrow the visible cards; clearing restores them
- [ ] T-310 Overdue card is highlighted; progress bar updates when a card is completed
- [ ] T-311 Keyboard shortcuts N, /, ?, Esc work
- [ ] T-312 Dark mode persists across reload
- [ ] T-313 Delete account signs out and the old credentials no longer work
- [ ] T-314 AI suggest checklist adds selected items (live)
- [ ] T-315 AI board starter creates a filled board (live)
- [ ] T-316 Chat answers a question about the board; a proposed action is confirmed and appears on the board (live)
- [ ] T-317 Chat action is not applied when the user does not confirm

### C2. Security
- [ ] T-330 User B cannot open user A's board by URL
- [ ] T-331 Cookie is not readable from `document.cookie`
- [ ] T-332 A card titled `<img src=x onerror=alert(1)>` renders as text, no dialog fires (SEC-60)
- [ ] T-333 A description link `javascript:alert(1)` does nothing (SEC-61)
- [ ] T-334 No CSP violations reported in the console on any screen (SEC-80)

### C3. Non-functional
- [ ] T-350 No axe violations on auth, board, card modal and chat panel, in both themes (NFR-10, NFR-16)
- [ ] T-351 Layout at 360, 768 and 1440 px has no page-level horizontal scroll (NFR-20)
- [ ] T-352 Modal traps focus and returns focus on close (NFR-13)
- [ ] T-353 Reduced-motion setting disables animations (NFR-15)
- [ ] T-354 Board with 500 cards loads under 300 ms (API) and renders without errors (NFR-01)
- [ ] T-355 Runs in Chromium, Firefox and WebKit (NFR-22)

## D. Release checks

- [ ] T-400 `uv run pytest --cov` passes with 90% or more coverage (NFR-40)
- [ ] T-401 `npm test` and `npx playwright test` pass
- [ ] T-402 `uv run ruff check` and `npx tsc --noEmit` pass (NFR-41)
- [ ] T-403 `pip-audit` and `npm audit --omit=dev` clean (SEC-95, SEC-96)
- [ ] T-404 Bundle size under 300 KB gzipped (NFR-02)
- [ ] T-405 Lighthouse performance 90 or more, accessibility 100 (NFR-04)
- [ ] T-406 `git ls-files` contains no `.env` or `.db` files (SEC-90)
- [ ] T-407 Every item in `Planning/SECURITY.md` is checked
