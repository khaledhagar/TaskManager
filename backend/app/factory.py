"""FastAPI application factory."""

from fastapi import FastAPI
from sqlmodel import Session, text

from app import auth
from app.config import Settings
from app.db import SessionDep, make_engine
from app.frontend import mount_frontend
from app.routes import ai, boards, cards
from app.users import cleanup_guests


def create_app(settings: Settings) -> FastAPI:
    """Build the FastAPI app for the given settings."""
    app = FastAPI(title="Task Manager")
    app.state.settings = settings
    app.state.engine = make_engine(settings.database_url)
    with Session(app.state.engine) as session:
        cleanup_guests(session)

    @app.get("/api/health")
    def health(session: SessionDep) -> dict:
        session.exec(text("SELECT 1"))
        return {"status": "ok", "database": "ok"}

    app.include_router(auth.router)
    app.include_router(boards.router)
    app.include_router(cards.router)
    app.include_router(ai.router)
    mount_frontend(app, settings.frontend_dist)
    return app
