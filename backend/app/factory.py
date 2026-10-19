"""FastAPI application factory."""

from fastapi import FastAPI
from sqlmodel import Session, text
from starlette.middleware.sessions import SessionMiddleware

from app import auth, google
from app.config import Settings
from app.db import SessionDep, make_engine
from app.frontend import mount_frontend
from app.mailer import Mailer
from app.middleware import add_origin_check
from app.routes import account, ai, background, boards, cards
from app.routes import files as file_routes
from app.routes import google as google_routes
from app.storage import LocalStorage
from app.users import cleanup_guests


def create_app(settings: Settings) -> FastAPI:
    """Build the FastAPI app for the given settings."""
    app = FastAPI(title="Task Manager")
    app.state.settings = settings
    app.state.engine = make_engine(settings.database_url)
    app.state.mailer = Mailer(settings)
    app.state.storage = LocalStorage(settings.storage_dir)
    app.state.oauth = google.make_oauth(settings) if settings.google_enabled else None
    # Short-lived cookie holding only the Google sign-in state, nonce and PKCE verifier.
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.jwt_secret,
        session_cookie="oauth_state",
        max_age=600,
        same_site="lax",
        https_only=settings.production,
    )
    add_origin_check(app, settings)
    with Session(app.state.engine, info={"storage": app.state.storage}) as session:
        cleanup_guests(session)

    @app.get("/api/health")
    def health(session: SessionDep) -> dict:
        session.exec(text("SELECT 1"))
        return {"status": "ok", "database": "ok"}

    for module in (auth, account, google_routes, boards, cards, ai, file_routes, background):
        app.include_router(module.router)
    mount_frontend(app, settings.frontend_dist)
    return app
