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
cd backend && uv run pytest
cd frontend && npm test
cd frontend && npx playwright test
```

## Configuration

Create a `.env` file in the project root:

```
OPENROUTER_API_KEY=...
JWT_SECRET=...
```

On Windows, if the project path is deep, also set `CUSTOM_TIKTOKEN_CACHE_DIR` to a short folder
(for example `C:/Users/<you>/.cache/tiktoken`). LiteLLM's tokenizer file otherwise exceeds the
260-character path limit.

See `Planning/PLAN.md` for the implementation plan.
