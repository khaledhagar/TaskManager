"""FastAPI application factory and ASGI entry point."""

from fastapi import FastAPI

from app.config import Settings, load_settings
from app.frontend import mount_frontend


def create_app(settings: Settings) -> FastAPI:
    """Build the FastAPI app for the given settings."""
    app = FastAPI(title="Task Manager")
    app.state.settings = settings

    @app.get("/api/health")
    def health() -> dict:
        return {"status": "ok"}

    mount_frontend(app, settings.frontend_dist)
    return app


app = create_app(load_settings())
