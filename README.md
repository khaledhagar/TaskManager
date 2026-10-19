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

See `Planning/PLAN.md` for the implementation plan.
