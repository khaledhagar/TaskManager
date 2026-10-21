# Test Plan

All tests are written before or with the code they cover (test first). Tick a test only when it exists and passes.
Security IDs (SEC-xx) and non-functional IDs (NFR-xx) refer to `Planning/SECURITY.md`.

Tools: `pytest` + `TestClient` (backend unit), `vitest` + Testing Library (frontend unit), Playwright + `@axe-core/playwright` (end to end).

## A. Backend unit tests (`backend/tests/`)

### A1. App and health
- [x] T-001 `GET /api/health` returns 200 with app and database status (NFR-30)
- [x] T-002 Unknown `/api/*` path returns JSON 404, not the SPA page
- [x] T-003 Non-API path returns `index.html` (SPA fallback)
- [x] T-004 Unhandled error returns generic 500 JSON without a stack trace (SEC-93)
- [x] T-005 `/docs` and `/openapi.json` return 404 when `ENV=production` (SEC-91)
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
- [x] T-164 4th forgot-password request for one email within an hour returns 429 (SEC-121)
- [x] T-165 Live: one real verification email arrives through Gmail SMTP (manual check)
- [x] T-166 Live: one real Google sign-in completes in the browser (manual check)

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
- [x] T-067 101st card on a board returns 400 with "Maximum cards in a board is 100. Delete a card to add a new one." (SEC-42); the board shows it as a toast and adds nothing

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
- [x] T-091 Form-encoded body on a JSON endpoint returns 422 (SEC-31)
- [x] T-092 Strings over their `max_length` return 422 for every field (SEC-40)
- [x] T-093 Body over 1 MB returns 413 (SEC-43)
- [x] T-094 SQL-like input (`'; DROP TABLE cards;--`) is stored as plain text (SEC-44)

### A10. Rate limits
- [x] T-100 11th sign-in within a minute from one IP returns 429 (SEC-50)
- [x] T-101 6th guest creation within an hour returns 429 (SEC-51)
- [x] T-102 4th AI call within a minute and 11th within a day return 429 (SEC-52)

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
- [x] T-130 CSP, nosniff, Referrer-Policy and Permissions-Policy headers on HTML and API responses (SEC-80, SEC-81)
- [x] T-131 HSTS only when `ENV=production` (SEC-82)
- [x] T-132 Request with an untrusted Host header is rejected in production (SEC-92)

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

### A15. Languages (Phase 11)
- [x] T-190 `Accept-Language: ar` returns Arabic server messages (sign-in failure, limits, not found); unknown languages fall back to English
- [x] T-191 `PATCH /auth/me` saves `language` (`en` or `ar` only, else 422) and `GET /auth/me` returns it (SEC-143)
- [x] T-192 Verification and reset emails are sent in the user's language
- [x] T-193 New users and guests get the demo board in their language; templates are created in the requested language
- [x] T-194 AI prompts ask for answers in the user's language (checklist, board starter, chat)

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
- [x] T-212 AI checklist suggestions: user selects items; only selected items are added
- [x] T-213 Chat panel renders messages, loading state, and Confirm buttons for actions
- [x] T-214 Confirming a chat action calls the matching card endpoint
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
- [x] T-240 Dictionaries: Arabic has every English key and the same placeholders; no value contains HTML (SEC-143)
- [x] T-241 `t()` fills placeholders; plurals follow Arabic rules for 0, 1, 2, 3, 11 and 100 items
- [x] T-242 Dates and numbers format per language (Arabic month names; Western digits by default)
- [x] T-243 Language button switches all visible text, sets `<html lang dir>`, saves the choice in the browser and on the account, and is restored on reload (NFR-17)
- [x] T-244 Sign-in screen offers the language button before sign-in; requests send `Accept-Language`
- [x] T-245 No hard-coded user-facing English left in components (checked by a test over the source)
- [x] T-246 Direction-dependent icons are mirrored in RTL
- [x] T-247 New board dialog: Blank, a template, or Describe it to AI (sends the description, shows progress, can be cancelled)
- [x] T-231 Timer is off by default (only the Focus timer button shows); turning it on shows the panel; turning it off stops it, clears it and hides it; the choice survives a reload

## C. End-to-end tests (Playwright, `frontend/e2e/`)

### C1. Functional
- [x] T-300 Continue as guest shows the demo board with dummy data
- [x] T-301 Sign up, open the verification link (console mode), sign out, sign in again; data persists
- [x] T-318 Forgot password, open the reset link, set a new password, sign in with it; old password fails
- [x] T-319 Password change in one browser signs out a second browser
- [x] T-320 Continue with Google using a faked Google provider in test mode
- [x] T-321 Unverified account sees the verify message and can resend the email
- [x] T-322 Upload a background photo; it shows after reload; remove it
- [x] T-323 Attach a PDF and an image, download both, delete one
- [x] T-324 A 5 MB file is refused with a clear message
- [x] T-325 Focus timer is off by default; turn it on, fast-forward the browser clock 25 minutes: break starts; reset focus and reset break work; turn it off
- [x] T-326 Focus timer 50/10 mode and state kept after reload
- [x] T-327 Switch to Arabic: page is right-to-left, texts are Arabic, choice survives reload and sign-in
- [x] T-328 Drag a card and reorder columns in Arabic (mouse and keyboard)
- [x] T-329 Every main screen at 360, 768, 1024 and 1440 px in both themes and both languages: no page-level horizontal scroll, nothing cut off (NFR-23)
- [x] T-335 Touch drag and drop on a phone-sized touch screen; the page still scrolls (NFR-24)
- [x] T-336 No axe violations in Arabic, in both themes (NFR-16, NFR-17)
- [x] T-302 Guest upgrade keeps boards and allows sign in with the new email
- [x] T-303 Create a blank board with 3 columns; create a board from each template
- [x] T-304 Rename, add, reorder (drag) and delete columns; undo column delete
- [x] T-305 Add a card; mark it completed; delete it; undo; delete again and let it expire
- [x] T-306 Open a card; edit description in markdown and preview; set priority, due date, labels; add, tick and delete checklist items
- [x] T-307 Drag a card to another column and within a column; reload; order persists
- [x] T-308 Move a card with the keyboard only (NFR-11)
- [x] T-309 Search and each filter narrow the visible cards; clearing restores them
- [x] T-310 Overdue card is highlighted; progress bar updates when a card is completed
- [x] T-311 Keyboard shortcuts N, /, ?, Esc work
- [x] T-312 Dark mode persists across reload
- [x] T-313 Delete account signs out and the old credentials no longer work
- [x] T-314 AI suggest checklist adds selected items (live)
- [x] T-315 AI board starter creates a filled board (live)
- [x] T-316 Chat answers a question about the board; a proposed action is confirmed and appears on the board (live)
- [x] T-317 Chat action is not applied when the user does not confirm

### C2. Security
- [x] T-330 User B cannot open user A's board by URL
- [x] T-331 Cookie is not readable from `document.cookie`
- [x] T-332 A card titled `<img src=x onerror=alert(1)>` renders as text, no dialog fires (SEC-60)
- [x] T-333 A description link `javascript:alert(1)` does nothing (SEC-61)
- [x] T-334 No CSP violations reported in the console on any screen (SEC-80)

### C3. Non-functional
- [x] T-350 No axe violations on auth, board, card modal and chat panel, in both themes (NFR-10, NFR-16)
- [x] T-351 Layout at 360, 768 and 1440 px has no page-level horizontal scroll (NFR-20)
- [x] T-352 Modal traps focus and returns focus on close (NFR-13)
- [x] T-353 Reduced-motion setting disables animations (NFR-15)
- [x] T-354 A full board (100 cards) loads under 300 ms (API), renders without errors, and the 101st card shows the limit message (NFR-01, SEC-42)
- [x] T-355 Runs in Chromium, Firefox and WebKit (NFR-22)

## E. New features (Phases 17-20)

### E1. Password strength (Phase 17)

- [x] T-500 Every example in `password_cases.json` gets the same rating (Weak / Medium / Strong) from the server rules
- [x] T-501 Every example in `password_cases.json` gets the same rating from the browser rules
- [x] T-502 The backend and frontend common-password lists are identical
- [x] T-503 Sign up, guest upgrade, reset, change and set password refuse a Weak password with 422 and a translated message (SEC-150)
- [x] T-504 A password containing the email name is Weak (SEC-152)
- [x] T-505 Sign in still accepts an existing password that is now rated Weak
- [x] T-506 Meter shows Weak / Medium / Strong with a hint, updates while typing, and is announced to screen readers
- [x] T-507 A Weak password shows the reason and sends no request (SEC-151)
- [x] T-508 Meter is translated and laid out right-to-left in Arabic, readable in dark mode
- [x] T-509 E2E: sign up refuses a Weak password and accepts a Medium one; "Continue with Google" is visible when configured

### E2. Board sharing backend (Phase 18)

- [x] T-510 Existing boards get their owner as admin on startup; running it twice changes nothing
- [x] T-511 Each endpoint follows the permission table for Viewer, Can update tasks, Full access and Admin (parametrized over every endpoint) (SEC-160)
- [x] T-512 A non-member gets 404 on every board, column, card, checklist, label, attachment, background, member and invite endpoint (SEC-21, SEC-160)
- [x] T-513 A Viewer gets 403 with "You can only view this board..." in English and Arabic
- [x] T-514 Can update tasks: move, complete and tick checklist work; add, edit, delete get 403 "Ask the board admin for full access..."
- [x] T-515 Role sent by the browser is ignored; only the stored role counts (SEC-161)
- [x] T-516 Invite: admin only; emails a link; the raw token is stored only as a SHA-256 hash (SEC-162)
- [x] T-517 Invite link works once and expires after 7 days (SEC-162)
- [x] T-518 Accept needs a signed-in, verified account with the invited email; another email gets 403 and the invite stays usable (SEC-163)
- [x] T-519 Accepting adds the user as Viewer; inviting an existing member is refused
- [x] T-520 Invite response and email never say whether the address has an account (SEC-167, SEC-174)
- [x] T-521 Cancel invite: admin only; a cancelled link no longer works
- [x] T-522 Guests cannot invite and cannot accept invites (SEC-165)
- [x] T-523 Change role: admin only; one role per member; the admin's own row cannot be changed or removed (SEC-164)
- [x] T-524 Remove member: admin only; the removed user gets 404 on the board afterwards
- [x] T-525 Leave board: a member can remove themselves; the admin cannot leave
- [x] T-526 Access request: Viewer or Can update tasks only; emails the admin; one pending per member per board
- [x] T-527 Approve request sets the chosen role (Can update tasks or Full access); decline removes it; admin only
- [x] T-528 `GET /boards` lists owned and shared boards with the user's role
- [x] T-529 Members list: members see member emails of that board only; there is no endpoint to search or list users (SEC-167)
- [x] T-530 Limits: 51st member and 21st pending invite refused (SEC-169)
- [x] T-531 Rate limits: 21st invite in an hour, 4th access request in a day, 429 (SEC-166)
- [x] T-532 Deleting a board removes members, invites and requests; deleting an account removes its memberships
- [x] T-533 Attachments uploaded by a member count against the member's storage
- [x] T-534 AI chat works for every member; AI checklist needs Full access
- [x] T-535 Moving a card or setting a label across boards is still refused, even for a member of both (SEC-22, SEC-23, SEC-168)
- [x] T-536 Invite and access-request emails follow the request language
- [x] T-537 Guest cleanup removes guest memberships too
- [x] T-538 Board list, board and members load in a few queries whatever the number of members
- [x] T-539 Every new user-facing server message has Arabic (existing i18n source check)

### E3. Board sharing UI (Phase 19)

- [x] T-540 Members panel lists members with one selected permission each; choosing another turns the old one off and saves
- [x] T-541 The admin row is fixed; Remove asks first; pending invites show Copy link, Share on WhatsApp, Cancel
- [x] T-542 Access requests show with Approve (Can update tasks / Full access) and Decline
- [x] T-543 Invite dialog validates the email, sends, then shows the link with Copy and Share on WhatsApp (`wa.me` link opened in a new tab)
- [x] T-544 Invite page shows board and inviter; Accept works; expired, used and other-email cases show clear messages
- [x] T-545 Signed-out visitor on the invite page is sent to sign in or sign up, then back to accept
- [x] T-546 Viewer: adding, editing, dragging or completing shows "ask the admin" with Request access; nothing changes and no request is sent
- [x] T-547 Can update tasks: drag and complete work; add and delete show the full-access message
- [x] T-548 Request access sends once, then shows "Request sent"
- [x] T-549 Board switcher groups "Your boards" and "Shared with you"; Leave board works
- [x] T-550 Board reloads when the tab regains focus (shows another member's change)
- [x] T-551 Guest admin sees "Create an account to share this board"
- [x] T-552 New texts in both dictionaries; no hard-coded English (existing source check)
- [x] T-553 E2E: admin invites a second user, who accepts and sees the board as Viewer
- [x] T-554 E2E: Viewer drag is refused with the message; Request access reaches the admin (email in outbox); admin approves Full access; the member can now add a card
- [x] T-555 E2E: admin changes a member to Can update tasks; the member can move and complete but not delete
- [x] T-556 E2E: removed member loses the board
- [x] T-557 E2E: members panel and invite page at phone width, dark mode, Arabic
- [x] T-558 Accessibility: members panel and invite page have no axe violations; the permission choice is a labelled radio group
- [x] T-559 Existing E2E suite still passes for single-user boards

### E4. Public boards, assignment, meeting link (Phase 20)

- [x] T-560 Admin switches a board to public; a random token link is created; only the admin can change it
- [x] T-561 Public page shows the board read-only without signing in; every change is refused (SEC-171)
- [x] T-562 Public view has no attachments, no member emails and no AI (SEC-171)
- [x] T-563 Switching back to private makes the old link return 404; public again gives a new token (SEC-170)
- [x] T-564 The board id never works as a public link (SEC-170)
- [x] T-565 Public responses send `X-Robots-Tag: noindex` (SEC-172)
- [x] T-566 Public endpoints are rate limited per IP (SEC-171)
- [x] T-567 Signed-in visitor joins a public board as Viewer; joining twice changes nothing
- [x] T-568 Assign: Full access and admin only; only members can be assigned (SEC-168)
- [x] T-569 Removing a member removes their assignments
- [x] T-570 Board response includes assignees and members' initials
- [x] T-571 Meeting link: admin only; https only (`javascript:` and `http:` refused); 500 characters max (SEC-173)
- [x] T-572 Email the link to members: admin only; sends to every member except the admin; 4th in an hour is 429 (SEC-166)
- [x] T-573 Meeting email follows the request language and contains only the board title and the link (SEC-174)
- [x] T-574 Card window assignee picker; initials on cards; "Assigned to me" filter
- [x] T-575 Start meeting opens the link in a new tab with `noopener noreferrer` (SEC-173)
- [x] T-576 Share panel: Private / Public switch and Copy link
- [x] T-577 Public page shows "View only" and Join board for signed-in visitors, Sign in for others
- [x] T-578 E2E: admin makes a board public; a signed-out browser sees it read-only; a signed-in user joins as Viewer
- [x] T-579 E2E: admin assigns a card to a member; the member filters "Assigned to me" and sees it
- [x] T-580 E2E: admin saves a Zoom link; a member sees Start meeting; Email the link to members puts an email in the outbox
- [x] T-581 E2E: public page, share panel and assignee picker at phone width, dark mode, Arabic
- [x] T-582 Accessibility: share panel, public page and assignee picker have no axe violations
- [x] T-583 Full regression passes: backend, frontend, Playwright in all browsers
- [x] T-584 Lighthouse still 90+ performance and 100 accessibility
- [x] T-585 `pip-audit` and `npm audit --omit=dev` clean
- [x] T-586 Bundle still under 300 KB gzipped
- [x] T-587 New texts in both dictionaries and server messages have Arabic
- [x] T-588 Deleting a public board makes its link return 404
- [x] T-589 Every item in `Planning/SECURITY.md` is checked

### E5. Voice input (Phase 21)

- [x] T-600 `useSpeech` starts and stops recognition, passes interim and final text, and uses `en-US` or `ar-EG` from the app language
- [x] T-601 The microphone button is hidden when the browser has no speech recognition
- [x] T-602 Final text is added to what the field already holds; nothing is saved or sent automatically
- [x] T-603 Errors show a translated message (microphone blocked, no speech, no network)
- [x] T-604 Button: `aria-pressed`, "Start voice input" / "Stop voice input", live region says "Listening" and "Stopped"
- [x] T-605 The privacy notice shows on first use only
- [x] T-606 Microphone appears in the composer, card title, description, checklist, search, new board dialog and AI chat, and not on email or password fields
- [x] T-607 Reduced motion turns the listening animation off
- [x] T-608 New texts in both dictionaries; no hard-coded English (existing source check)
- [x] T-609 Server sends `Permissions-Policy` with `microphone=(self)` and still blocks camera and geolocation (SEC-180)
- [x] T-610 E2E (fake speech): speak a card title into the composer, then press Enter; the card is added
- [x] T-611 E2E (fake speech): speak "add a card Call the supplier to In Progress" into the AI chat (AI mocked); confirming adds the card
- [x] T-612 E2E: Arabic speech fills the field right-to-left
- [x] T-613 E2E: microphone buttons at phone width, dark mode, Arabic; no axe violations
- [x] T-614 Full regression passes (backend, frontend, Playwright, Lighthouse, audits)

### E7. Comments and activity (Phase 22)

- [x] T-640 Alembic: the baseline migration matches the models; upgrading an existing database keeps its data
- [x] T-641 Add, list, edit and delete comments; order newest last
- [x] T-642 Viewers read comments but cannot write; "Can update tasks" and above can (SEC-200)
- [x] T-643 Authors edit or delete their own comments; the admin can delete any; others get 403
- [x] T-644 Comment text over 5,000 characters is refused; Markdown shows without raw HTML (SEC-200)
- [x] T-645 @mention of a member creates a notification; text that names a non-member does nothing (SEC-201)
- [x] T-646 Non-members get 404 on every comment endpoint
- [x] T-647 Every board change writes one activity entry with actor, kind and summary
- [x] T-648 Activity holds no card descriptions or comment text; only members can read it (SEC-205)
- [x] T-649 Only the newest 1,000 activity entries per board are kept
- [x] T-650 Card window shows comments and History; board Activity panel lists recent changes
- [x] T-651 @ suggests board members while typing (keyboard and screen reader friendly)
- [x] T-652 Comments and activity in Arabic, RTL, dark mode, phone width
- [x] T-653 E2E: two members comment on a card; a mention shows up for the other
- [x] T-654 E2E: activity shows a card moved by another member
- [x] T-655 Accessibility: no axe violations in comments, History and Activity

### E8. Notifications and reminders (Phase 23)

- [x] T-660 Assigning a card notifies the assignee (in app and by email if on)
- [x] T-661 A mention notifies the mentioned member
- [x] T-662 `send_reminders()` sends one email per user per day listing cards due tomorrow and overdue
- [x] T-663 Users who turned emails off get none; the turn-off link works without signing in and only for that user (SEC-203)
- [x] T-664 Notifications only concern boards the user belongs to; after removal from a board, old ones open nothing (SEC-202)
- [x] T-665 `POST /api/cron/reminders` without the right `CRON_SECRET` is refused (SEC-204)
- [x] T-666 `uv run python -m app.jobs reminders` runs the job locally
- [x] T-667 Bell shows the unread count; opening a notification opens the card; Mark all as read
- [x] T-668 The unread count refreshes on load, when the tab regains focus and after the user's own actions; there is no timed polling
- [x] T-671 Emails in English and Arabic
- [x] T-673 E2E: assignment shows in the other member's bell and in the email outbox
- [x] T-674 Bell and notifications list at phone width, dark, Arabic; no axe violations
- [x] T-675 Gmail quota: reminder emails are batched per user (one per day)

### E9. Organize and focus sessions (Phase 24)

- [x] T-680 Archive and restore a card; archived cards leave the board and the card limit
- [x] T-681 Archive and restore a board (admin only); archived boards in their own switcher section
- [x] T-682 Duplicate a card copies title, details, labels, checklist, priority and due date only
- [x] T-683 Duplicate a board copies columns, cards, labels and checklists only; board limit applies (SEC-207)
- [x] T-684 Save a board as template; it is private and appears in the New board dialog; 20 at most (SEC-207)
- [x] T-685 Star and unstar boards; starred first in the switcher
- [x] T-686 WIP limit set per column (1-100); over-limit count shows a warning
- [x] T-687 Auto-complete setting: moving into the last column completes, moving out reopens
- [x] T-688 Only an image attachment of the same card can be its cover; cover shows on the card
- [x] T-689 Permissions for every new endpoint follow the role table
- [x] T-690 E2E: archive a card and restore it
- [x] T-691 E2E: duplicate a board and create a board from a saved template
- [x] T-692 E2E: WIP warning and auto-complete in the browser
- [x] T-693 New UI in Arabic, RTL, dark, phone width
- [x] T-694 Accessibility: no axe violations on the new panels
- [x] T-695 Migration for the new columns runs on an existing database
- [x] T-696 A finished focus period linked to a card is saved and shown on the card
- [x] T-697 Focus minutes over 60 per session are refused; sessions are saved only for the signed-in user (SEC-214)
- [x] T-698 E2E: point the focus timer at a card; after a period (fast clock) the card shows the session

### E10. List view and export (Phase 25)

- [x] T-700 View switch Board / List kept in the URL
- [x] T-701 List view shows every card, sorts by each column and follows the filters
- [x] T-706 CSV export has every card; cells starting with = + - @ are escaped (SEC-208)
- [x] T-707 JSON export contains the board and member emails only (SEC-208)
- [x] T-708 Export only for members (404 otherwise)
- [x] T-709 E2E: switch to the list, sort it, open a card from it
- [x] T-710 E2E: download CSV and JSON
- [x] T-711 List view in Arabic, RTL, dark, phone width
- [x] T-712 Accessibility: no axe violations in the list view
- [x] T-713 List view stays fast with 100 cards

### E11. Workspaces, start page and full regression (Phase 26)

- [x] T-720 Create, rename and delete a workspace; deleting it keeps its boards as boards without a workspace
- [x] T-721 Workspaces are private: another user's workspace gives 404 for reading, renaming, deleting, members and adding a board (SEC-215)
- [x] T-722 Limits: 20 workspaces per user, names 1-100 characters, at most 10 boards per new workspace, 1-20 columns per board; the board limit still applies (SEC-215)
- [x] T-723 Create a workspace with several boards in one request; each board has the given columns and no cards
- [x] T-724 Create a board with chosen columns and an optional workspace; move a board into and out of a workspace (board admin and workspace owner only) (SEC-215)
- [x] T-725 AI column suggestion: 3-8 names per board, at most 40 characters, plain text, in the request language, never cards; `max_tokens` set; input limited (SEC-216)
- [x] T-726 AI suggestion falls back to To Do, In Progress, Done when the model fails or the daily limit is reached; AI rate limits apply (SEC-216)
- [x] T-727 Start page middle: starred, each workspace with its boards, then boards without a workspace, shared boards, archived folded
- [x] T-728 With no boards and no workspaces the start page shows only "New workspace" and "New board" with their explanations
- [x] T-729 After sign-in the start page shows; a new guest lands on the demo board; "All boards" returns to the start page
- [x] T-730 New workspace dialog: add and remove boards, suggest columns, edit them, summary message, create
- [x] T-731 New board dialog: suggest columns from the name, edit the chips, choose a workspace
- [x] T-732 E2E: create a workspace with two boards and AI columns (faked model); open a board: its columns are there and empty; add a card
- [x] T-733 E2E: an empty account shows only the two start cards; create a board; the start page then lists it
- [x] T-734 Start page and new dialogs in Arabic, right to left, dark, at phone, tablet and desktop widths
- [x] T-735 Accessibility: no axe violations on the start page and the new dialogs; the whole flow works with the keyboard
- [x] T-736 Migration adds `workspaces` and `boards.workspace_id` to an existing database
- [x] T-737 Board switcher grouped by workspace; "Move to workspace" updates the switcher and the start page
- [x] T-738 Left panel: each workspace's Boards button lists its boards and opens the chosen one; Members shows its members by board
- [x] T-739 Workspace members list: everyone on the workspace's boards with their permission, owner only (404 otherwise) (SEC-217)
- [x] T-740 Left panel on phone and tablet opens from a menu button, closes after a choice, works with keyboard and screen reader
- [x] T-741 An invitation to an existing account creates an in-app notification that opens the invitation
- [x] T-742 Changes by others to a card assigned to you notify you in the app; your own changes never do; one entry per card and person within 10 minutes (SEC-217)
- [x] T-743 Removed members and people no longer assigned get no card notifications (SEC-217)
- [x] T-744 What's new on the start page shows the latest notifications (unread first, up to 5); each opens its card; See all opens the list
- [x] T-745 E2E: a second person is invited and assigned; the start page shows both notifications and opens them
- [x] T-714 Full regression after Phases 21-26: backend, frontend, Playwright in all browsers, axe, Lighthouse, audits

### E12. Fixes from the user's check (2026-10-21, Phase 26)

- [x] T-750 Messages (toasts) shown while a window is open appear inside it and their buttons (Undo, Dismiss) work
- [x] T-751 A blocked microphone says how to allow it again, inside the card window too, every time it is pressed
- [x] T-752 A column moves with Move left / Move right in its menu (mirrored in Arabic); the order is saved
- [x] T-753 The server the user runs serves every feature built so far (restarted after each phase); export, auto-complete and archive checked on it
- [x] T-754 Archive a whole column with its cards (Undo); restore it from the Archived panel; its cards do not count toward the limit
- [x] T-755 Board options next to Ask AI is a labeled button; the Board / List switch has icons and a clear selected state
- [x] T-756 Saved templates show on the start page and start a board in one click
- [x] T-757 The guest bar says "Sign up to save your boards" and opens the sign-up form

### E13. Fixes from the user's second check (2026-10-22, Phase 26)

- [x] T-760 A sign-up whose confirmation email cannot be sent says so (503, translated) and keeps no account, so it can be retried
- [x] T-761 A guest upgrade whose email cannot be sent is undone; forgot-password and resend keep their neutral answer
- [x] T-762 Assignment and mention emails that fail never block the action; the in-app notification is still saved
- [x] T-763 An invitation whose email failed can be sent again
- [x] T-764 A guest starts with the board's column names only: no example cards or labels; new accounts keep the example cards
- [x] T-765 Voice in one-line fields (search, titles) drops the trailing "." or "?" the speech service adds; longer text keeps it
- [x] T-766 The Excel (CSV) download is laid out like the board: each column's name heads its tasks, with a Status column beside it (in the user's language)
- [x] T-767 Voice in a one-line field (a card or board name) replaces the old text; longer text gets it added at the end
- [x] T-768 Sign-up asks for the password twice; a mismatch sends nothing
- [x] T-769 A board's admin deletes it from its "..." menu on the start page, after confirming
- [x] T-770 A column is dragged by its whole header (mouse or finger); on phones columns stack, on tablets they wrap, nothing is cut off at the sides; board options is a bold "..." icon and Share opens the sharing panel

### E14. Voice commands (Phase 27, proposed)

- [ ] T-780 The parser understands each command in English, with and without a column, and returns what to do
- [ ] T-781 The parser understands each command in Arabic (including letter forms such as أ/إ/ا and ة/ه)
- [ ] T-782 Names are matched ignoring case, punctuation and trailing "."; a close name matches; several matches are offered to choose from; no match says so
- [ ] T-783 Due dates: today, tomorrow, next week and weekdays become the right date; priorities map to Low, Medium, High, Urgent
- [ ] T-784 A change is shown as a sentence and done only after Confirm; Cancel does nothing; delete keeps its Undo
- [ ] T-785 Look-ups (open card, open board, search, filters, all boards, help) happen at once
- [ ] T-786 Commands obey the board role like the buttons (a Viewer cannot move; "Can update tasks" cannot rename) and explain whom to ask (SEC-218)
- [ ] T-787 Phrases not understood (two words or more) go to the AI chat panel; one word does not (SEC-219)
- [ ] T-788 The V shortcut and the button start listening; Escape stops; the panel announces results to screen readers
- [ ] T-789 E2E (faked speech): add a card by voice and confirm; it is saved
- [ ] T-790 E2E (faked speech): move and complete a card by voice; search and "show overdue" filter the board
- [ ] T-791 E2E (faked speech): an ambiguous card name offers a choice; a not-understood phrase opens the AI chat (faked reply)
- [ ] T-792 E2E: voice commands in Arabic, right to left, dark, at phone width
- [ ] T-793 Accessibility: no axe violations with the voice panel open; keyboard only
- [ ] T-794 Full regression after Phase 27: backend, frontend, Playwright in all browsers, axe, Lighthouse, audits

### E6. Documentation (Phase 29)

- [ ] T-620 The build script writes all 8 `.docx` files and each one opens (read back with `python-docx`)
- [ ] T-621 Every file has a title page with "Task Manager", headings, and page numbers; long files have a table of contents
- [ ] T-622 `01_Overview.docx` has a short description (at most 2 sentences) and a long description
- [ ] T-623 `03_Test_Plan.docx` lists every test ID in `TEST_PLAN.md` and every test file in the repository
- [ ] T-624 `04_Project_Plan.docx` lists every phase and `05_Security.docx` every SEC and NFR item
- [ ] T-625 `07_Pages.docx` has a screenshot for every page; `06_User_Flows.docx` covers every flow in the design
- [ ] T-626 `08_Build_Prompts.docx` has one prompt per phase, each with goal, tasks and success criteria
- [ ] T-627 No document contains secrets: no `.env` values, API keys, tokens, passwords or personal email addresses (SEC-190)

## D. Release checks

- [x] T-400 `uv run pytest --cov` passes with 90% or more coverage (NFR-40)
- [x] T-401 `npm test` and `npx playwright test` pass
- [x] T-402 `uv run ruff check` and `npx tsc --noEmit` pass (NFR-41)
- [x] T-403 `pip-audit` and `npm audit --omit=dev` clean (SEC-95, SEC-96)
- [x] T-404 Bundle size under 300 KB gzipped (NFR-02)
- [x] T-405 Lighthouse performance 90 or more, accessibility 100 (NFR-04)
- [x] T-406 `git ls-files` contains no `.env` or `.db` files (SEC-90)
- [x] T-407 Every item in `Planning/SECURITY.md` is checked
