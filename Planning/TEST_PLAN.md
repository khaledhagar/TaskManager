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
- [x] T-020 Sign up creates an unverified user, seeds demo board, sends a verification email, does not sign in
- [x] T-021 Sign up with existing email returns 409
- [x] T-022 Sign up rejects invalid email, password under 8 or over 128 characters (SEC-02)
- [x] T-023 Email is stored lower-cased; sign in is case-insensitive
- [x] T-024 Password stored as Argon2 hash, not plain text (SEC-01)
- [x] T-025 Sign in with correct password sets cookie for a verified user
- [x] T-026 Unknown email and wrong password return the same 401 message (SEC-03)
- [x] T-027 Guest sign-in creates guest user with demo board
- [x] T-028 `GET /auth/me` returns the user; without cookie returns 401
- [x] T-029 Expired token returns 401 (SEC-05)
- [x] T-030 Tampered token and `alg: none` token return 401 (SEC-05, SEC-06)
- [x] T-031 Sign out clears the cookie (SEC-07)
- [x] T-032 Cookie flags: HttpOnly, SameSite=Lax, Path=/; Secure in production (SEC-10, SEC-11)
- [x] T-033 No response body contains the token (SEC-12)
- [x] T-034 Guest upgrade with email + password sends a verification email; after verifying, boards are kept
- [x] T-035 Upgrade from a regular account returns 400; upgrade to a taken email returns 409 (SEC-08)
- [x] T-036 Guest cleanup removes guests older than 7 days with their data, keeps newer guests and regular users (SEC-102)
- [x] T-037 Delete account removes the user and all their data (SEC-101)

### A3b. Email verification, password reset, Google sign-in (Phase 6)
- [x] T-140 Sign in before verifying returns 403 with a "verify your email" message (SEC-110)
- [x] T-141 Verification link verifies the account and signs in
- [x] T-142 Expired verification token is rejected; reused token is rejected (SEC-112)
- [x] T-143 Tampered or unknown token is rejected
- [x] T-144 Only the token hash is stored in the database (SEC-111)
- [x] T-145 Resend verification sends a new email; answer is the same for unknown emails (SEC-113)
- [x] T-146 Forgot password sends a reset email; answer is the same for unknown emails (SEC-113)
- [x] T-147 Reset with a valid token sets the new password; old password no longer works
- [x] T-148 Reset token expires after 30 minutes and works once (SEC-112)
- [x] T-149 Reset signs out other sessions (old JWT rejected) (SEC-114)
- [x] T-150 Reset password follows the same length rules as sign up (SEC-02)
- [x] T-151 Change password requires the correct current password (SEC-115)
- [x] T-152 Change password signs out other sessions but keeps the current one (SEC-114)
- [x] T-153 Google-only user can set a password without a current password (SEC-115)
- [x] T-154 Google login redirects to Google with state and PKCE parameters (SEC-116)
- [x] T-155 Google callback with a wrong or missing state is rejected (SEC-116)
- [x] T-156 Google callback creates a verified user with the demo board and signs in
- [x] T-157 Google callback for an existing password account links it and marks it verified (SEC-117)
- [x] T-158 Google account with `email_verified: false` is rejected (SEC-117)
- [x] T-159 Signed-in guest using Google keeps their boards and stops being a guest
- [x] T-160 Google email already linked to a different Google account is rejected
- [x] T-161 Email links use `APP_URL`, not the request Host header (SEC-118)
- [x] T-162 Console mailer logs the link; SMTP mailer uses STARTTLS with the configured user (smtplib faked) (SEC-119)
- [x] T-163 Reset email text contains no password and explains what to do if not requested (SEC-120)
- [ ] T-164 4th forgot-password request for one email within an hour returns 429 (SEC-121)
- [ ] T-165 Live: one real verification email arrives through Gmail SMTP (manual check)
- [ ] T-166 Live: one real Google sign-in completes in the browser (manual check)

### A4. Boards
- [x] T-040 List returns only the current user's boards
- [x] T-041 Create board gives 3 default columns
- [x] T-042 Create board with a template gives the template's columns and cards
- [x] T-043 Unknown template name returns 422 (SEC-41)
- [x] T-044 Get full board returns columns, cards, checklists and labels in position order
- [x] T-045 Rename and delete board
- [x] T-046 51st board returns 400 (SEC-42)

### A5. Columns
- [x] T-050 Add column appends at the end
- [x] T-051 Rename column
- [x] T-052 Delete column removes its cards; remaining positions stay contiguous
- [x] T-053 Reorder columns saves the new order; an order list that is not exactly the board's column ids returns 400
- [x] T-054 21st column returns 400 (SEC-42)

### A6. Cards
- [x] T-060 Create card at the end of a column with default priority Medium
- [x] T-061 Update title, details, completed, priority, due date
- [x] T-062 Invalid priority returns 422 (SEC-41)
- [x] T-063 Delete card removes its checklist items and label links
- [x] T-064 Move within a column reorders positions correctly
- [x] T-065 Move to another column at a position; both columns stay contiguous
- [x] T-066 Move to a position past the end puts the card last
- [x] T-067 501st card on a board returns 400 (SEC-42)

### A7. Checklist and labels
- [x] T-070 Add, rename, toggle and delete checklist items
- [x] T-071 51st checklist item returns 400 (SEC-42)
- [x] T-072 Create and delete labels; deleting a label removes it from cards
- [x] T-073 Set card labels replaces the full set
- [x] T-074 Invalid label color returns 422 (SEC-41)

### A8. Authorization (run for every resource type)
- [x] T-080 User B gets 404 on user A's board, column, card, checklist item and label, for every method (SEC-20, SEC-21)
- [x] T-081 Moving a card into another user's column returns 404 (SEC-22)
- [x] T-082 Using another board's label on a card returns 404 (SEC-23)
- [x] T-083 AI endpoints return 404 for another user's card or board (SEC-24)
- [x] T-084 Every non-auth endpoint returns 401 without a cookie

### A9. CSRF and input limits
- [x] T-090 POST with a foreign `Origin` header returns 403 (SEC-33)
- [ ] T-091 Form-encoded body on a JSON endpoint returns 422 (SEC-31)
- [ ] T-092 Strings over their `max_length` return 422 for every field (SEC-40)
- [ ] T-093 Body over 1 MB returns 413 (SEC-43)
- [ ] T-094 SQL-like input (`'; DROP TABLE cards;--`) is stored as plain text (SEC-44)

### A10. Rate limits
- [ ] T-100 11th sign-in within a minute from one IP returns 429 (SEC-50)
- [ ] T-101 6th guest creation within an hour returns 429 (SEC-51)
- [ ] T-102 4th AI call within a minute and 11th within a day return 429 (SEC-52)

### A11. AI (model call mocked)
- [x] T-110 Checklist suggestion returns 3 to 7 items and saves nothing
- [x] T-111 Board starter creates a board with the returned columns and cards
- [x] T-112 Malformed model JSON returns a friendly 502 (SEC-74)
- [x] T-113 Model timeout or error returns a friendly 502 without provider details (SEC-74)
- [x] T-114 Chat sends the board as context and returns the reply
- [x] T-115 Chat actions with valid card and column ids are returned
- [x] T-116 Chat actions with unknown types or ids from other boards are dropped (SEC-72)
- [x] T-117 Only the last 20 messages are sent and `max_tokens` is set (SEC-73)
- [x] T-118 System prompt marks board content as data (SEC-75)
- [x] T-119 Model is `openrouter/nvidia/nemotron-3.5-super-vl:free` with the backup model in the `models` list and `max_tokens` set
- [x] T-121 OpenRouter 429 returns a friendly "AI limit reached for today" message (SEC-53)
- [x] T-120 Live smoke test (run with `uv run pytest -m live`; skipped by default to save the free daily quota): a real text reply and a structured reply come back

### A12. Security headers
- [ ] T-130 CSP, nosniff, Referrer-Policy and Permissions-Policy headers on HTML and API responses (SEC-80, SEC-81)
- [ ] T-131 HSTS only when `ENV=production` (SEC-82)
- [ ] T-132 Request with an untrusted Host header is rejected in production (SEC-92)

### A14. Files: attachments and backgrounds (Phase 9)
- [x] T-170 Upload an attachment, list it on the card, download it with the same bytes, delete it
- [x] T-171 File over 4 MB returns 413; 11th file on a card returns 400 (SEC-130)
- [x] T-172 Account over 100 MB (guest over 10 MB) returns 400 (SEC-130)
- [x] T-173 Renamed program (`.exe` content named `.pdf`), SVG and HTML are rejected (SEC-132)
- [x] T-174 Fake image (text named `.png`) rejected as attachment preview and as background (SEC-133)
- [x] T-175 Background photo with GPS metadata is stored without it; stored size at most 2 MB (SEC-131, SEC-133)
- [x] T-176 Stored key is random; a file name like `../../x.txt` is stored safely and shown sanitized (SEC-134)
- [x] T-177 Other users get 404 for download, delete and background of someone else's card or board (SEC-135)
- [x] T-178 Download headers: attachment disposition, content type, nosniff, sandbox CSP (SEC-136)
- [x] T-179 Cross-site multipart upload (foreign Origin) returns 403 (SEC-137)
- [x] T-180 Deleting a card, column, board or account removes the stored files (SEC-139)
- [x] T-181 Background preset set and removed; unknown preset returns 422
- [x] T-182 Usage endpoint reports bytes used and the limit
- [x] T-183 Local storage put / get / delete and missing-key behaviour

## B. Frontend unit tests (`frontend/src/**/*.test.tsx`)

- [x] T-200 API client sends credentials and JSON; turns error responses into readable messages
- [x] T-201 API client shows a specific message for 429
- [x] T-202 Auth form: validates email and password length; switches between sign in and sign up
- [x] T-203 Theme toggle switches theme and saves the choice
- [x] T-204 Card shows title, priority badge, labels, due date, checklist progress
- [x] T-205 Due-date status: overdue, due within 2 days, later, completed (no warning)
- [x] T-206 Filter logic: text search, label, priority, completed, combined
- [x] T-207 Board progress percentage, including an empty board
- [x] T-208 Card modal saves title, description, priority, due date
- [x] T-209 Markdown preview renders headings and lists; raw HTML is shown as text; `javascript:` links removed (SEC-61)
- [x] T-210 Undo toast: delete is sent after 5 seconds; Undo cancels it
- [x] T-211 Keyboard shortcuts: N opens new card input, / focuses search, ? opens help, Esc closes; ignored while typing in an input
- [ ] T-212 AI checklist suggestions: user selects items; only selected items are added
- [ ] T-213 Chat panel renders messages, loading state, and Confirm buttons for actions
- [ ] T-214 Confirming a chat action calls the matching card endpoint
- [x] T-215 Optimistic move rolls back and shows an error when the API fails (NFR-31)
- [x] T-216 No `dangerouslySetInnerHTML` in the source (checked by a grep test) (SEC-60)
- [x] T-217 Auth screen shows Continue with Google, sign in, sign up, guest and Forgot password
- [x] T-218 Check-your-inbox screen offers Resend email with a cooldown
- [x] T-219 Reset password page reads the token from the link and validates the new password
- [x] T-220 Account menu shows Change password, or Set password for Google-only users
- [x] T-221 Attachments: files over the limit or of a blocked type are refused before upload with a clear message
- [x] T-222 Attachments: upload progress, success, error, download link, delete with confirm
- [x] T-223 Background picker: presets apply at once; photo is shrunk to at most 2560 px before upload; remove works
- [x] T-224 Board stays readable over a background (dim layer and solid columns present)
- [x] T-225 Timer: remaining time computed from the end time, correct after a simulated reload
- [x] T-226 Timer: focus end switches to break; break end waits for the user before the next focus
- [x] T-227 Timer: reset focus and reset break each reset only their own phase
- [x] T-228 Timer: 25/5 and 50/10 modes; switching mode resets cleanly
- [x] T-229 Timer: pause keeps the remaining time; skip moves to the other phase
- [x] T-230 Timer: tab title shows time left; phase change announced once; mute stops the chime
- [x] T-231 Timer is off by default (only the Focus timer button shows); turning it on shows the panel; turning it off stops it, clears it and hides it; the choice survives a reload

## C. End-to-end tests (Playwright, `frontend/e2e/`)

### C1. Functional
- [ ] T-300 Continue as guest shows the demo board with dummy data
- [ ] T-301 Sign up, open the verification link (console mode), sign out, sign in again; data persists
- [ ] T-318 Forgot password, open the reset link, set a new password, sign in with it; old password fails
- [ ] T-319 Password change in one browser signs out a second browser
- [ ] T-320 Continue with Google using a faked Google provider in test mode
- [ ] T-321 Unverified account sees the verify message and can resend the email
- [ ] T-322 Upload a background photo; it shows after reload; remove it
- [ ] T-323 Attach a PDF and an image, download both, delete one
- [ ] T-324 A 5 MB file is refused with a clear message
- [ ] T-325 Focus timer is off by default; turn it on, fast-forward the browser clock 25 minutes: break starts; reset focus and reset break work; turn it off
- [ ] T-326 Focus timer 50/10 mode and state kept after reload
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
