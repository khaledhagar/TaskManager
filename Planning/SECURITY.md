# Security and Non-Functional Checklist

The app will be published on the internet. Every item must be checked, with a test or a manual verification noted, before release.
Test IDs refer to `Planning/TEST_PLAN.md`.

## 1. Authentication

- [ ] Passwords hashed with Argon2 (`pwdlib`), never stored or logged in plain text (SEC-01)
- [ ] Password rules: 8 to 128 characters; email validated and lower-cased (SEC-02)
- [ ] Sign-in failure message is the same for unknown email and wrong password (no user enumeration) (SEC-03)
- [ ] JWT signed with HS256 using `JWT_SECRET` (32+ random bytes); app refuses to start without it (SEC-04)
- [ ] JWT expires after 7 days; expired or tampered tokens return 401 (SEC-05)
- [ ] `alg` is pinned when decoding (no `none` algorithm) (SEC-06)
- [ ] Sign out clears the cookie (SEC-07)
- [ ] Guest upgrade requires a guest session and an unused email (SEC-08)

## 2. Session cookie

- [ ] Cookie is `HttpOnly`, `SameSite=Lax`, `Path=/` (SEC-10)
- [ ] Cookie is `Secure` when `ENV=production` (SEC-11)
- [ ] Token is never returned in a response body or readable by JavaScript (SEC-12)

## 3. Authorization (IDOR)

- [ ] Every board, column, card, checklist and label endpoint checks that the board belongs to the current user (SEC-20)
- [ ] Access to another user's resource returns 404, not 403, so ids are not confirmed (SEC-21)
- [ ] Moving a card into another user's column is rejected (SEC-22)
- [ ] Setting a label from another board on a card is rejected (SEC-23)
- [ ] AI endpoints only read boards the user owns (SEC-24)

## 4. CSRF and CORS

- [ ] No CORS middleware: frontend and API share one origin (SEC-30)
- [ ] State-changing endpoints accept only `application/json` bodies, so cross-site forms cannot call them (SEC-31)
- [ ] `SameSite=Lax` cookie blocks cross-site POST with credentials (SEC-32)
- [ ] Requests with a foreign `Origin` header on POST/PATCH/PUT/DELETE are rejected with 403 (SEC-33)

## 5. Input validation and abuse limits

- [ ] All request bodies are Pydantic models with `max_length` on strings (title 200, details 10000, checklist item 300, label 40, chat message 2000) (SEC-40)
- [ ] Enums validated: priority, label color, template name (SEC-41)
- [ ] Per-user caps: 50 boards, 20 columns per board, 500 cards per board, 50 checklist items per card (SEC-42)
- [ ] Request body size limited to 1 MB (SEC-43)
- [ ] All database access through SQLModel parameters; no string-built SQL (SEC-44)

## 6. Rate limiting

- [ ] Sign in and sign up: 10 per minute per IP (SEC-50)
- [ ] Guest creation: 5 per hour per IP (SEC-51)
- [ ] AI endpoints: 20 per minute and 200 per day per user (SEC-52)
- [ ] Exceeded limits return 429 with a clear message shown in the UI (SEC-53)

## 7. Output and XSS

- [ ] React escapes all text; no `dangerouslySetInnerHTML` anywhere (SEC-60)
- [ ] Markdown rendered with `react-markdown` without raw HTML; only `http`, `https` and `mailto` links allowed; links open with `rel="noopener noreferrer"` (SEC-61)
- [ ] AI output is treated as untrusted text and rendered the same safe way (SEC-62)

## 8. AI-specific risks

- [ ] `OPENROUTER_API_KEY` used only on the server; never sent to the browser (SEC-70)
- [ ] Chat actions are proposals only; nothing is written until the user clicks Confirm, which calls normal, authorized endpoints (SEC-71)
- [ ] Proposed actions referencing cards or columns not on the user's board are dropped (prompt injection defense) (SEC-72)
- [ ] Chat history sent to the model is capped (last 20 messages) and `max_tokens` is set (cost control) (SEC-73)
- [ ] Model errors and timeouts return a friendly 502 without leaking provider details (SEC-74)
- [ ] System prompt tells the model it only assists with this app; board content is wrapped as data, not instructions (SEC-75)

## 9. HTTP security headers

- [ ] `Content-Security-Policy`: `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` (SEC-80)
- [ ] `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` disabling camera, microphone and geolocation (SEC-81)
- [ ] `Strict-Transport-Security` in production (SEC-82)
- [ ] Fonts and icons bundled locally (no third-party CDNs), so CSP stays `'self'` (SEC-83)

## 10. Configuration and secrets

- [ ] `.env` and `*.db` are git-ignored; secrets never committed (SEC-90)
- [ ] `/docs`, `/redoc` and `/openapi.json` disabled when `ENV=production` (SEC-91)
- [ ] `TrustedHostMiddleware` with the production host name (SEC-92)
- [ ] Unhandled errors return a generic 500 JSON with no stack trace (SEC-93)
- [ ] Logs never contain passwords, tokens or the API key (SEC-94)

## 11. Dependencies

- [ ] `uv run --with pip-audit pip-audit` reports no known vulnerabilities (SEC-95)
- [ ] `npm audit --omit=dev` reports no high or critical issues (SEC-96)
- [ ] All dependency versions locked (`uv.lock`, `package-lock.json`) (SEC-97)

## 12. Data protection

- [x] Deleting a board removes all its columns, cards, checklists and labels (SEC-100)
- [ ] Users can delete their own account and all its data (SEC-101)
- [ ] Guest accounts older than 7 days are removed (SEC-102)
- [x] SQLite runs in WAL mode with foreign keys on (SEC-103)

---

# Non-Functional Requirements

## Performance

- [ ] Board with 500 cards loads from the API in under 300 ms locally (NFR-01)
- [ ] Production JS bundle under 300 KB gzipped (NFR-02)
- [ ] Drag and drop stays smooth (no visible lag) with 200 cards on screen (NFR-03)
- [ ] Lighthouse performance score 90 or more (NFR-04)

## Accessibility (WCAG 2.2 AA)

- [ ] Text contrast at least 4.5:1 in light and dark themes (NFR-10)
- [ ] All actions reachable by keyboard, including drag and drop via dnd-kit keyboard sensor (NFR-11)
- [ ] Visible focus ring on every interactive element (NFR-12)
- [ ] Modals trap focus, close on Escape, and return focus to the trigger (NFR-13)
- [ ] Icon buttons have `aria-label`; live region announces drag results and toasts (NFR-14)
- [ ] Animations respect `prefers-reduced-motion` (NFR-15)
- [ ] No violations from `@axe-core/playwright` on auth, board and card modal screens (NFR-16)

## Usability and responsiveness

- [ ] Works at 360 px, 768 px and 1440 px widths without horizontal page scroll (board scrolls inside its area) (NFR-20)
- [ ] Every API action shows feedback: optimistic update, loading state, or error toast (NFR-21)
- [ ] Works in current Chrome, Firefox, Safari and Edge (NFR-22)

## Reliability and operations

- [ ] `GET /api/health` reports app and database status (NFR-30)
- [ ] Failed optimistic updates roll back and show an error (NFR-31)
- [ ] Database file location configurable via `DATABASE_URL`; README covers backup by copying the file (NFR-32)
- [ ] Server starts with one command and serves the built frontend (NFR-33)

## Maintainability

- [ ] Backend tests cover at least 90% of lines (NFR-40)
- [ ] `ruff check` and `tsc --noEmit` pass with no errors (NFR-41)
- [ ] Short modules: no file over 300 lines (NFR-42)
