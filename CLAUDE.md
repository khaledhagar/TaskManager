# Task Manager



## Business Requirements



- An MVP of a Kanban style Project Management application as a web app  

- The web app should have option create new boards

- The system should have authentication and authorization with guest option that can create boards 

- The board has fixed 3 columns on the start which can be renamed and can increase the number of columns

- Each card has a title and details only and mark to check it as completed, can open it add description or add checklist inside it

- Drag and drop interface to move cards between columns

- Add a new card to a column; delete an existing card

- The priority is a slick, professional, gorgeous UI/UX with very simple features

- The app should open with dummy data populated for the single board

### Approved enhancements

- Columns can be reordered by drag and drop
- Cards have due dates and color labels
- Search and filter cards on a board
- Dark mode
- Guest upgrade to a regular account, keeping boards; guests older than 7 days are cleaned up
- AI checklist generator inside a card
- AI board starter: describe a project, get a pre-filled board
- AI chat assistant panel: the user can ask anything about the app or their boards
- Card priority (Low, Medium, High, Urgent)
- AI chat can create, move and complete cards, each confirmed by the user
- Board templates: Blank, Sprint, Bug tracking, Personal
- Undo toast after deleting a card or column
- Board progress bar
- Overdue and due-soon highlighting
- Keyboard shortcuts: N, /, Esc, ?
- Markdown in card descriptions

## Plan

The full plan with phases and success criteria is in `Planning/PLAN.md`. Keep it updated: tick criteria as they are met.

- Stack: FastAPI + SQLModel/SQLite, pwdlib + PyJWT cookie auth, LiteLLM, React + TypeScript + Vite, dnd-kit
- Tests: pytest, vitest, Playwright
- Phases: scaffolding, database, auth, board API, AI backend, frontend foundation, board UI, AI UI, polish, integration testing, done
- Deferred enhancements (N9-N14 in the plan) are not built unless the user approves them
- Also: delete account (needed for a published site)

## Security and Testing

The site will be published. It must be secure and meet functional and non-functional requirements.

- `Planning/SECURITY.md`: security and non-functional checklist (SEC-xx, NFR-xx). Every item must be checked before release.
- `Planning/TEST_PLAN.md`: every test (T-xxx). Write tests first; tick a test only when it exists and passes.
- Key rules: ownership check on every endpoint (404 for others' data), httpOnly SameSite cookie, Origin check, input length limits, rate limits on auth/guest/AI, strict CSP with no CDNs, no raw HTML in markdown, AI chat actions require user confirmation, API key never sent to the browser.

## Production Target

Build and test locally on SQLite. Production will be Vercel with hosted Postgres (Neon or Supabase), handled in the final Deployment phase. Keep the code portable:

- All configuration from environment variables
- No SQLite-specific SQL; SQLite pragmas only when the URL is SQLite
- Rate-limit counters behind one swappable store class (memory locally, Redis in production)
- Background jobs (guest cleanup) as plain functions, callable on startup or from a cron endpoint

## UI/UX

Follow the UI/UX Specification in `Planning/PLAN.md`: calm, fast, professional, light and dark themes, optimistic updates, keyboard accessible, WCAG 2.2 AA.



## AI design


When writing code to make calls to LLMs, use LiteLLM via OpenRouter with a free model: `openrouter/nvidia/nemotron-3.5-super-vl:free`, falling back to `openrouter/nvidia/nemotron-3-super-120b-a12b:free`. Always set `max_tokens`. See "AI Design" in `Planning/PLAN.md` for the free-tier limits (50 requests per day for the whole account) and how the app handles them.

There is an OPENROUTER_API_KEY in the .env file in the project root (free tier, no credits).



## Technical Details



- The backend should be in backend/ and be a uv project, using FastAPI.  

- The frontend should be in frontend  

- The database should use SQLite , allowing for a users table with sign up and sign in.  

- The frontend is statically built and served by FastAPI

- As simple as possible but with an elegant UI



## Color Scheme



- Accent Yellow: `#ecad0a` - accent lines, highlights

- Blue Primary: `#209dd7` - links, key sections

- Purple Secondary: `#753991` - submit buttons, important actions

- Dark Navy: `#032147` - main headings

- Gray Text: `#888888` - supporting text, labels



## Strategy



1. Write plan with success criteria for each phase to be checked off. Include project scaffolding, including .gitignore, and rigorous unit testing.

2. Execute the plan ensuring all criteria are met

3. Carry out extensive integration testing with Playwright or similar, fixing defects

4. Only complete when the MVP is finished and tested, with the server running and ready for the user



## Coding standards



1. Use latest versions of libraries and idiomatic approaches as of today

2. Keep it simple - NEVER over-engineer, ALWAYS simplify, NO unnecessary defensive programming. No extra features - focus on simplicity.

3. Be concise. Keep README minimal. IMPORTANT: no emojis ever



