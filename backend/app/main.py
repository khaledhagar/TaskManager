"""FastAPI application factory and ASGI entry point."""

from fastapi import FastAPI
from sqlmodel import text

from app.config import Settings, load_settings
from app.db import SessionDep, make_engine
from app.frontend import mount_frontend


def create_app(settings: Settings) -> FastAPI:
    """Build the FastAPI app for the given settings."""
    app = FastAPI(title="Task Manager")
    app.state.settings = settings
    app.state.engine = make_engine(settings.database_url)

    @app.get("/api/health")
    def health(session: SessionDep) -> dict:
        session.exec(text("SELECT 1"))
        return {"status": "ok", "database": "ok"}

    mount_frontend(app, settings.frontend_dist)
    return app


app = create_app(load_settings())
