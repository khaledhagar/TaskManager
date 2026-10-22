"""FastAPI application factory."""

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlmodel import Session, text
from starlette.middleware.sessions import SessionMiddleware

from app import auth, google
from app.config import Settings
from app.db import SessionDep, make_engine
from app.frontend import mount_frontend
from app.hardening import add_hardening
from app.i18n import add_language, tr
from app.mailer import MAIL_FAILED, Mailer, MailError
from app.middleware import add_origin_check
from app.ratelimit import RateLimiter, make_store
from app.routes import (
    account,
    ai,
    archive,
    background,
    boards,
    cards,
    comments,
    cron,
    export,
    invites,
    meeting,
    members,
    notifications,
    organize,
    public,
    workspaces,
)
from app.routes import files as file_routes
from app.routes import google as google_routes
from app.sharing import backfill_admins
from app.storage import make_storage
from app.users import cleanup_guests


def create_app(settings: Settings) -> FastAPI:
    """Build the FastAPI app for the given settings."""
    docs = (
        {}
        if not settings.production
        else {"docs_url": None, "redoc_url": None, "openapi_url": None}
    )
    app = FastAPI(title="Task Manager", **docs)
    app.state.settings = settings
    app.state.engine = make_engine(settings.database_url)
    app.state.mailer = Mailer(settings)
    app.state.limiter = RateLimiter(make_store(settings.database_url, app.state.engine))
    app.state.storage = make_storage(settings)
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
    add_hardening(app, settings)
    add_language(app)
    with Session(app.state.engine, info={"storage": app.state.storage}) as session:
        cleanup_guests(session)
        backfill_admins(session)

    @app.get("/api/health")
    def health(session: SessionDep) -> dict:
        session.exec(text("SELECT 1"))
        return {"status": "ok", "database": "ok"}

    @app.exception_handler(MailError)
    async def mail_failed(_request, _exc):
        return JSONResponse({"detail": tr(MAIL_FAILED)}, status_code=503)

    routers = (auth, account, google_routes, boards, cards, ai, file_routes, background)
    sharing = (members, invites, public, meeting, comments, notifications)
    for module in (*routers, *sharing, archive, organize, export, workspaces, cron):
        app.include_router(module.router)
    mount_frontend(app, settings.frontend_dist)
    return app
