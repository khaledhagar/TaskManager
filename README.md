# Task Manager

A simple Kanban board web app. Create boards, manage columns and cards, drag cards between columns, and track checklists. Sign up, sign in, or continue as a guest.

## Stack

- Backend: FastAPI + SQLite (`backend/`, uv project)
- Frontend: React + TypeScript + Vite (`frontend/`), built and served by FastAPI

## Run

```bash
cd frontend
npm install
npm run build

cd ../backend
uv sync
uv run fastapi run app/main.py
```

Open http://localhost:8000

## Test

```bash
cd backend && uv run pytest --cov=app   # fails under 90% coverage
cd frontend && npm test
cd frontend && npm run build && npx playwright test   # end-to-end (Edge; Firefox and WebKit run the smoke tests)
cd frontend && LIVE=1 npx playwright test -g @live    # real AI calls (uses the free daily quota)
```

The end-to-end tests start their own server on port 8001 with a fresh database in the system temp
folder (`frontend/e2e/server.py`). First time only: `npx playwright install firefox webkit`.

## Configuration

Create a `.env` file in the project root:

```
OPENROUTER_API_KEY=...
JWT_SECRET=...            # 32+ random characters
APP_URL=http://localhost:8000

# Email: console (default) logs links; smtp sends through Gmail with an App Password
EMAIL_MODE=console
SMTP_USER=you@gmail.com
SMTP_PASSWORD=...

# Google sign-in (optional; the button is hidden when not set)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Google OAuth redirect URI: `{APP_URL}/api/auth/google/callback`.

Optional settings:

```
ENV=production            # development (default) or production: HSTS, trusted hosts, no API docs
ALLOWED_HOSTS=example.com # comma-separated; defaults to the host of APP_URL
DATABASE_URL=sqlite:///path/to/taskmanager.db   # default: backend/taskmanager.db
STORAGE_DIR=path/to/storage                     # uploaded files; default: backend/storage
```

## Backup

Stop the server, then copy the database file (`backend/taskmanager.db`, or the path in
`DATABASE_URL`) and the `backend/storage/` folder. Restore by copying them back.

On Windows, if the project path is deep, also set `CUSTOM_TIKTOKEN_CACHE_DIR` to a short folder
(for example `C:/Users/<you>/.cache/tiktoken`). LiteLLM's tokenizer file otherwise exceeds the
260-character path limit.

See `Planning/PLAN.md` for the implementation plan.
