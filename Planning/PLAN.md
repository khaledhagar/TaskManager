# Task Manager - Implementation Plan

A professional Kanban task manager: FastAPI + SQLite backend, statically built React frontend served by FastAPI, with an AI assistant.
Each phase is small and must have all success criteria checked before the next phase starts.
The app will be published, so two companion checklists are part of every phase:

- `Planning/SECURITY.md`: security and non-functional requirements (SEC-xx, NFR-xx)
- `Planning/TEST_PLAN.md`: every test (T-xxx), written test first; a phase is done only when its tests pass

## Stack

| Layer | Choice |
|-------|--------|
| Backend | Python 3.13, FastAPI, uv project in `backend/` |
| Database | SQLite via SQLModel |
| Auth | Argon2 password hashing (`pwdlib`), JWT (`PyJWT`) in an httpOnly cookie |
| AI | LiteLLM -> OpenRouter, model `openrouter/openai/gpt-oss-120b`, Cerebras as provider |
| Frontend | React + TypeScript + Vite in `frontend/`, built to static files |
| Drag and drop | `@dnd-kit/core` + `@dnd-kit/sortable` |
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
- Typography: one sans family (Inter, self-hosted), 14 px base, clear scale (12 / 14 / 16 / 20 / 28), navy `#032147` headings, gray `#888888` supporting text.
- Color roles: purple `#753991` primary buttons, blue `#209dd7` links and focus rings, yellow `#ecad0a` accent lines, the progress bar and due-soon state; red for overdue and destructive actions. Dark theme uses deep navy surfaces with the same accents, contrast checked to 4.5:1.
- Spacing and shape: 4 px grid, 8 px card radius, 12 px panel radius, soft layered shadows; cards lift slightly on hover and while dragging.
- Feedback: optimistic updates everywhere; skeleton loaders on first load; toasts for errors and undo; inline editing (click a title, Enter saves, Esc cancels).
- Cards: title, then a compact meta row (priority dot, labels as small pills, due date chip, checklist progress like "3/5"); completed cards are dimmed with a strikethrough title.
- Card modal: two-column on desktop (content left; priority, due date, labels and AI actions right), full-screen sheet on mobile.
- Motion: 150-200 ms ease-out transitions, drag overlay with a slight tilt, all disabled under `prefers-reduced-motion`.
- Empty states: short helpful text plus one clear action (for example "No cards yet - press N to add one").
- Accessibility: keyboard for everything, visible focus rings, ARIA labels on icon buttons, screen-reader announcements for drag and drop.
- The `frontend-design` skill guides the visual pass in Phase 9; screenshots are reviewed at 360, 768 and 1440 px in both themes.

## Data Model

- `users`: id, email (unique, null for guests), password_hash (null for guests), is_guest, created_at
- `boards`: id, owner_id -> users, title, created_at
- `columns`: id, board_id -> boards, title, position
- `cards`: id, column_id -> columns, title, details, completed, priority, due_date, position, created_at
- `checklist_items`: id, card_id -> cards, text, done, position
- `labels`: id, board_id -> boards, name, color
- `card_labels`: card_id -> cards, label_id -> labels

Authorization rule: a user can only read or change boards they own (and everything under them).

## API (all under `/api`)

- Auth: `POST /auth/signup`, `POST /auth/signin`, `POST /auth/guest`, `POST /auth/upgrade`, `POST /auth/signout`, `GET /auth/me`, `DELETE /auth/me`
- Boards: `GET /boards`, `POST /boards` (optional `template`), `GET /boards/{id}` (full board), `PATCH /boards/{id}`, `DELETE /boards/{id}`
- Columns: `POST /boards/{id}/columns`, `PATCH /columns/{id}`, `DELETE /columns/{id}`, `POST /boards/{id}/columns/order`
- Cards: `POST /columns/{id}/cards`, `PATCH /cards/{id}`, `DELETE /cards/{id}`, `POST /cards/{id}/move`
- Checklist: `POST /cards/{id}/checklist`, `PATCH /checklist/{id}`, `DELETE /checklist/{id}`
- Labels: `POST /boards/{id}/labels`, `DELETE /labels/{id}`, `PUT /cards/{id}/labels`
- AI: `POST /ai/cards/{id}/checklist`, `POST /ai/boards`, `POST /ai/chat`

Search, filters, undo and keyboard shortcuts run in the browser; no API needed.
Undo: the card or column is hidden at once and the DELETE is sent after 5 seconds unless the user clicks Undo.
Everything else is served from the built frontend (`frontend/dist`), with SPA fallback to `index.html`.

## AI Design

- One module `backend/app/ai.py` with a single `complete(messages)` helper calling `litellm.completion` with model `openrouter/openai/gpt-oss-120b` and OpenRouter provider routing set to Cerebras.
- `OPENROUTER_API_KEY` read from the root `.env`.
- Checklist generator and board starter ask for JSON output and validate it with Pydantic.
- Chat sends the user's current board (columns, cards with ids, due dates, priorities) plus a short description of the app's features as context; history is kept in the browser and sent with each request.
- Chat replies are JSON: `{"reply": str, "actions": [...]}`. Actions are `create_card`, `move_card`, `complete_card`. The browser shows each action with a Confirm button that calls the normal card endpoints, so no extra write endpoint is needed.
- Unit tests mock `complete`; one live smoke test runs only when the API key is present.

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

- [ ] Sign up, sign in, sign out, `me`
- [ ] Guest sign-in creates a guest user with the demo board
- [ ] New regular users also get the demo board
- [ ] Guest upgrade sets email and password on the guest user, boards kept
- [ ] Guest cleanup on startup removes guests older than 7 days
- [ ] JWT in httpOnly, SameSite=Lax cookie; `JWT_SECRET` read from `.env`
- [ ] Unit tests: signup, duplicate email, wrong password, guest flow, upgrade, cleanup, 401 without cookie

## Phase 4 - Boards, Columns, Cards, Labels API

- [ ] Board CRUD; new boards start with the 3 default columns, or the chosen template
- [ ] Column add, rename, delete, reorder
- [ ] Card create, update (title, details, completed, priority, due_date), delete, move with contiguous positions
- [ ] Checklist item create, toggle, rename, delete
- [ ] Labels create, delete, set on card
- [ ] Unit tests for every endpoint, including: user A cannot access user B's board (404), move and reorder are correct

## Phase 5 - AI Backend

- [ ] `ai.py` helper; live smoke test returns a reply from the Cerebras-hosted model
- [ ] `POST /ai/cards/{id}/checklist` returns 3-7 suggested items (not saved until the user accepts)
- [ ] `POST /ai/boards` creates a board with columns and cards from a description
- [ ] `POST /ai/chat` answers using the current board as context and may return proposed actions
- [ ] Unknown action types or card ids not on the board are dropped from the response
- [ ] Unit tests with mocked `complete`: valid output, malformed JSON gives a clear 502, authorization enforced

## Phase 6 - Frontend Foundation

- [ ] Design tokens from the color scheme (accent `#ecad0a`, primary `#209dd7`, secondary `#753991`, navy `#032147`, gray `#888888`), light and dark themes
- [ ] Typed API client using `fetch` with cookies
- [ ] Auth screen: sign in, sign up, "Continue as guest"
- [ ] App shell: header with board switcher, new board, theme toggle, account menu (sign out, upgrade guest)
- [ ] Vitest tests: auth form validation, API client error handling, theme toggle

## Phase 7 - Board UI

- [ ] Board view renders columns and cards
- [ ] Inline column rename, add column, delete column, drag to reorder columns
- [ ] Add card, delete card with confirm, completed checkbox with muted style
- [ ] Card shows priority badge, labels, due date (red when overdue, yellow when due within 2 days), checklist progress
- [ ] Board progress bar in the board header
- [ ] Card detail modal: title, markdown description (edit and preview), priority, due date, labels, checklist
- [ ] Drag and drop cards within and between columns, optimistic update, persisted
- [ ] Search box and filters (label, priority, completed) above the board
- [ ] Undo toast for card and column delete
- [ ] Keyboard shortcuts N, /, Esc, ? with a help dialog
- [ ] Vitest tests: card render, modal edits, filtering logic, due-date status, undo timer

## Phase 8 - AI UI

- [ ] "Suggest checklist" button in card modal; user picks which items to add
- [ ] New board dialog: Blank, templates, or "Describe it to AI"
- [ ] Chat side panel with message history, loading state, clear button, and Confirm buttons for proposed actions
- [ ] Vitest tests: suggestion selection, chat message rendering

## Phase 9 - Polish

- [ ] Consistent spacing, typography, shadows, hover and focus states in both themes
- [ ] Smooth drag overlay and drop animation
- [ ] Empty states (no cards, no boards, no search results)
- [ ] Enter to save, Escape to cancel/close
- [ ] Responsive layout: columns scroll horizontally on small screens

## Phase 10 - Security and Non-Functional Hardening

- [ ] Security headers, Origin check, body size limit, TrustedHost, production settings (`ENV=production`)
- [ ] Rate limits on auth, guest and AI endpoints
- [ ] Per-user resource caps
- [ ] Every SEC-xx item in `Planning/SECURITY.md` checked with its test
- [ ] Dependency audits clean; ruff and tsc clean; coverage 90% or more

## Phase 11 - Integration Testing (Playwright)

- [ ] Guest flow: continue as guest, demo board with dummy data visible
- [ ] Sign up, sign out, sign in, data persists; guest upgrade keeps boards
- [ ] Create board with 3 default columns; rename, add, reorder, delete columns
- [ ] Add card, edit description, due date, labels, checklist, mark completed, delete
- [ ] Drag a card to another column; reload; position persists
- [ ] Search and filters narrow the visible cards
- [ ] Dark mode toggle persists across reload
- [ ] Priority filter, overdue highlight, progress bar, undo delete, keyboard shortcuts, markdown preview
- [ ] Board from template
- [ ] AI: suggest checklist, AI board starter, chat reply, chat action confirmed and applied (live, with key)
- [ ] Two users cannot see each other's boards
- [ ] All defects fixed and re-tested

## Phase 12 - Done

- [ ] Every test in `Planning/TEST_PLAN.md` ticked and passing
- [ ] Every item in `Planning/SECURITY.md` ticked
- [ ] README has run and test instructions
- [ ] Server running locally with the built frontend, ready for the user
