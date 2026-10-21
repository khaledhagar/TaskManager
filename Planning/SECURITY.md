# Security and Non-Functional Checklist

The app will be published on the internet. Every item must be checked, with a test or a manual verification noted, before release.
Test IDs refer to `Planning/TEST_PLAN.md`.

## 1. Authentication

- [x] Passwords hashed with Argon2 (`pwdlib`), never stored or logged in plain text (SEC-01)
- [x] Password rules: 8 to 128 characters; email validated and lower-cased (SEC-02)
- [x] Sign-in failure message is the same for unknown email and wrong password (no user enumeration) (SEC-03)
- [x] JWT signed with HS256 using `JWT_SECRET` (32+ random bytes); app refuses to start without it (SEC-04)
- [x] JWT expires after 7 days; expired or tampered tokens return 401 (SEC-05)
- [x] `alg` is pinned when decoding (no `none` algorithm) (SEC-06)
- [x] Sign out clears the cookie (SEC-07)
- [x] Guest upgrade requires a guest session and an unused email (SEC-08)

## 1b. Email verification, password reset and Google sign-in

- [x] Email + password accounts cannot sign in until the email is verified (SEC-110)
- [x] Verification and reset tokens: 32+ random bytes from `secrets`, stored only as SHA-256 hashes (SEC-111)
- [x] Verification links expire after 24 hours, reset links after 30 minutes; both single use (SEC-112)
- [x] Forgot password and resend verification give the same answer whether or not the account exists (SEC-113)
- [x] Password reset or change signs out all other sessions (token version in the JWT) (SEC-114)
- [x] Change password requires the current password (unless the account has none yet) (SEC-115)
- [x] Google sign-in checks `state`, PKCE, ID token signature, issuer, audience and nonce (SEC-116)
- [x] Only Google accounts with `email_verified` are accepted; linking to an existing account happens only then (SEC-117)
- [x] Email links built from `APP_URL` (https in production), never from the request Host header (SEC-118)
- [x] Gmail App Password and Google client secret only in `.env` / Vercel settings; never logged or sent to the browser (SEC-119)
- [x] Emails never contain passwords; reset email says what to do if the user did not ask for it (SEC-120)
- [x] Forgot password and resend verification: 3 per hour per email, 10 per hour per IP (SEC-121)
- [x] Reset and verify pages do not leak the token to third parties (`Referrer-Policy`, no external resources) (SEC-122)

## 2. Session cookie

- [x] Cookie is `HttpOnly`, `SameSite=Lax`, `Path=/` (SEC-10)
- [x] Cookie is `Secure` when `ENV=production` (SEC-11)
- [x] Token is never returned in a response body or readable by JavaScript (SEC-12)

## 3. Authorization (IDOR)

- [x] Every board, column, card, checklist and label endpoint checks that the board belongs to the current user (SEC-20)
- [x] Access to another user's resource returns 404, not 403, so ids are not confirmed (SEC-21)
- [x] Moving a card into another user's column is rejected (SEC-22)
- [x] Setting a label from another board on a card is rejected (SEC-23)
- [x] AI endpoints only read boards the user owns (SEC-24)

## 4. CSRF and CORS

- [x] No CORS middleware: frontend and API share one origin (SEC-30)
- [x] State-changing endpoints accept only `application/json` bodies, so cross-site forms cannot call them (SEC-31)
- [x] `SameSite=Lax` cookie blocks cross-site POST with credentials (SEC-32)
- [x] Requests with a foreign `Origin` header on POST/PATCH/PUT/DELETE are rejected with 403 (SEC-33)

## 5. Input validation and abuse limits

- [x] All request bodies are Pydantic models with `max_length` on strings (title 200, details 10000, checklist item 300, label 40, chat message 2000) (SEC-40)
- [x] Enums validated: priority, label color, template name (SEC-41)
- [x] Per-user caps: 50 boards, 20 columns per board, 100 cards per board (the user sees "Maximum cards in a board is 100"), 50 checklist items per card (SEC-42)
- [x] Request body size limited to 1 MB (SEC-43)
- [x] All database access through SQLModel parameters; no string-built SQL (SEC-44)

## 5b. File uploads (attachments and board backgrounds)

- [x] Attachments: 4 MB per file, 10 per card, 100 MB per account, 10 MB per guest; checked on the server (SEC-130)
- [x] Backgrounds: 10 MB upload limit, at most 2 MB stored after re-encoding (SEC-131)
- [x] File type decided by real content (magic bytes) plus extension, against an allow list; SVG, HTML, scripts and programs rejected (SEC-132)
- [x] Images opened and re-saved with Pillow: fake or broken images rejected, metadata (GPS, camera) stripped (SEC-133)
- [x] Stored under random keys; the user's file name is display-only and sanitized; no path traversal (SEC-134)
- [x] Downloads only through an owner-checked endpoint; other users get 404; no public links (SEC-135)
- [x] Download headers: `Content-Disposition: attachment` (inline only for images), stored content type, `nosniff`, `Content-Security-Policy: sandbox` (SEC-136)
- [x] Upload endpoints protected by the Origin check, because multipart forms can be sent cross-site (SEC-137)
- [x] Uploads rate-limited: 20 per minute per user (SEC-138)
- [x] Deleting a card, column, board or account deletes its stored files; no orphans left (SEC-139)
- [x] Request size checked before reading the whole body (no memory exhaustion) (SEC-140)
- [x] Storage credentials only in `.env` / Vercel settings; local storage folder git-ignored (SEC-141)
- [x] Focus timer stores only timer state in the browser; no personal data (SEC-142)
- [x] Translations are plain text (no HTML); the language value is checked against `en` / `ar` on the server and the browser (SEC-143)

## 6. Rate limiting

- [x] Sign in and sign up: 10 per minute per IP (SEC-50)
- [x] Guest creation: 5 per hour per IP (SEC-51)
- [x] AI endpoints: 3 per minute and 10 per day per user, because the whole account only has 50 free requests per day (SEC-52)
- [x] Exceeded limits return 429 with a clear message shown in the UI (SEC-53)

## 7. Output and XSS

- [x] React escapes all text; no `dangerouslySetInnerHTML` anywhere (SEC-60)
- [x] Markdown rendered with `react-markdown` without raw HTML; only `http`, `https` and `mailto` links allowed; links open with `rel="noopener noreferrer"` (SEC-61)
- [x] AI output is treated as untrusted text and rendered the same safe way (SEC-62)

## 8. AI-specific risks

- [x] `OPENROUTER_API_KEY` used only on the server; never sent to the browser (SEC-70)
- [x] Chat actions are proposals only; nothing is written until the user clicks Confirm, which calls normal, authorized endpoints (SEC-71)
- [x] Proposed actions referencing cards or columns not on the user's board are dropped (prompt injection defense) (SEC-72)
- [x] Chat history sent to the model is capped (last 20 messages) and `max_tokens` is set (cost control) (SEC-73)
- [x] Model errors and timeouts return a friendly 502 without leaking provider details (SEC-74)
- [x] System prompt tells the model it only assists with this app; board content is wrapped as data, not instructions (SEC-75)
- [x] UI states that AI features send card or board text to a third-party AI service; only the needed text is sent (SEC-76)

## 9. HTTP security headers

- [x] `Content-Security-Policy`: `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` (SEC-80)
- [x] `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` disabling camera, microphone and geolocation (SEC-81)
- [x] `Strict-Transport-Security` in production (SEC-82)
- [x] Fonts and icons bundled locally (no third-party CDNs), so CSP stays `'self'` (SEC-83)

## 10. Configuration and secrets

- [x] `.env` and `*.db` are git-ignored; secrets never committed (SEC-90)
- [x] `/docs`, `/redoc` and `/openapi.json` disabled when `ENV=production` (SEC-91)
- [x] `TrustedHostMiddleware` with the production host name (SEC-92)
- [x] Unhandled errors return a generic 500 JSON with no stack trace (SEC-93)
- [x] Logs never contain passwords, tokens or the API key (SEC-94)

## 11. Dependencies

- [x] `uv run --with pip-audit pip-audit` reports no known vulnerabilities (SEC-95)
- [x] `npm audit --omit=dev` reports no high or critical issues (SEC-96)
- [x] All dependency versions locked (`uv.lock`, `package-lock.json`) (SEC-97)

## 12. Data protection

- [x] Deleting a board removes all its columns, cards, checklists and labels (SEC-100)
- [x] Users can delete their own account and all its data (SEC-101)
- [x] Guest accounts older than 7 days are removed (SEC-102)
- [x] SQLite runs in WAL mode with foreign keys on (SEC-103)

---

# Non-Functional Requirements

## 13. Passwords (Phase 17)

- [ ] Weak passwords refused on the server for sign up, guest upgrade, reset, change and set password (SEC-150)
- [ ] The browser uses the same rules (shared example table) and blocks Weak before sending (SEC-151)
- [ ] Common passwords and passwords containing the email name are Weak (SEC-152)

## 14. Board sharing (Phases 18-20)

- [ ] Every endpoint checks membership (404 for non-members) and the role it needs (403 with a message) (SEC-160)
- [ ] Roles are read from the database only, never from the request (SEC-161)
- [ ] Invite tokens: random, stored as SHA-256, single use, expire after 7 days (SEC-162)
- [ ] An invite is accepted only by a signed-in, verified account with the invited email (SEC-163)
- [ ] Only the admin manages members, invites, requests, visibility and the meeting link; the admin cannot be demoted or removed (SEC-164)
- [ ] Guests cannot invite or be invited (SEC-165)
- [ ] Rate limits: invites 20 per hour per user, access requests 3 per day per member per board, meeting emails 3 per hour per board (SEC-166)
- [ ] No user search or listing; invites never reveal whether an address has an account; members see only their boards' member emails (SEC-167)
- [ ] Cards can be assigned only to members; cross-board moves and labels still refused (SEC-168)
- [ ] Limits: 50 members and 20 pending invites per board (SEC-169)
- [ ] Public boards use a random token, not the board id; making the board private revokes it (SEC-170)
- [ ] Public view is read-only, without attachments, member emails or AI, and rate limited per IP (SEC-171)
- [ ] Public board responses send `X-Robots-Tag: noindex` (SEC-172)
- [ ] Meeting links are https only and open with `rel="noopener noreferrer"` (SEC-173)
- [ ] Invite, access-request and meeting emails are plain text, follow the language and contain only the needed link (SEC-174)

## Performance

- [x] Board with 500 cards loads from the API in under 300 ms locally (NFR-01)
- [x] Production JS bundle under 300 KB gzipped (NFR-02)
- [x] Drag and drop stays smooth (no visible lag) on a full board of 100 cards, the board limit (NFR-03). Measured in Edge: no frame over 100 ms (one 84 ms frame on the first drag). At 200 cards dnd-kit paused 170-200 ms, so the user chose a 100-card limit on 2026-10-21.
  - 2026-10-21 (Edge, Playwright): no crash (a crash from cards flipping between columns was fixed), typical frame 25 ms, but 2-3 pauses of about 170-200 ms per drag (at pick-up and when the card enters another column) while dnd-kit re-measures every card. Open: needs a decision (accept, or show fewer cards per column at once).
- [x] Lighthouse performance score 90 or more (NFR-04)

## Accessibility (WCAG 2.2 AA)

- [x] Text contrast at least 4.5:1 in light and dark themes (NFR-10)
- [x] All actions reachable by keyboard, including drag and drop via dnd-kit keyboard sensor (NFR-11)
- [x] Visible focus ring on every interactive element (NFR-12)
- [x] Modals trap focus, close on Escape, and return focus to the trigger (NFR-13)
- [x] Icon buttons have `aria-label`; live region announces drag results and toasts (NFR-14)
- [x] Animations respect `prefers-reduced-motion` (NFR-15)
- [x] No violations from `@axe-core/playwright` on auth, board and card modal screens (NFR-16)
- [x] `<html lang>` and `dir` always match the chosen language, so screen readers use the right voice and reading order (NFR-17)

## Usability and responsiveness

- [x] Works at 360 px, 768 px and 1440 px widths without horizontal page scroll (board scrolls inside its area) (NFR-20)
- [x] Every API action shows feedback: optimistic update, loading state, or error toast (NFR-21)
- [x] Works in current Chrome, Firefox, Safari and Edge (NFR-22)
- [x] Every feature works at 360, 768, 1024 and 1440 px, in light and dark themes, in English and Arabic (NFR-23)
- [x] Touch: cards and columns can be dragged on phones and tablets without blocking page scrolling; tap targets at least 40 px (NFR-24)
- [x] Arabic layout is fully right-to-left with no mixed-direction glitches; user-typed names display correctly in either direction (NFR-25)

## Reliability and operations

- [x] `GET /api/health` reports app and database status (NFR-30)
- [x] Failed optimistic updates roll back and show an error (NFR-31)
- [x] Database file location configurable via `DATABASE_URL`; README covers backup by copying the file (NFR-32)
- [x] Server starts with one command and serves the built frontend (NFR-33)
- [x] Portability rules in `Planning/PLAN.md` followed: config from env, no SQLite-specific SQL, swappable rate-limit store, background jobs as plain functions (NFR-34)

## Maintainability

- [x] Backend tests cover at least 90% of lines (NFR-40)
- [x] `ruff check` and `tsc --noEmit` pass with no errors (NFR-41)
- [x] Short modules: no file over 300 lines (NFR-42)
