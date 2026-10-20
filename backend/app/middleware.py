"""Cross-site request check (SEC-33): state-changing requests must come from our own pages."""

from urllib.parse import urlparse

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.config import Settings
from app.i18n import tr

SAFE = {"GET", "HEAD", "OPTIONS"}
DEV_ORIGINS = {"http://localhost:5173", "http://127.0.0.1:5173"}


def add_origin_check(app: FastAPI, settings: Settings) -> None:
    """Reject POST/PUT/PATCH/DELETE whose Origin is neither this host nor an allowed origin."""
    allowed = {settings.app_url} | (set() if settings.production else DEV_ORIGINS)

    @app.middleware("http")
    async def origin_check(request: Request, call_next):
        origin = request.headers.get("origin")
        if request.method not in SAFE and origin:
            same_host = urlparse(origin).netloc == request.headers.get("host")
            if not same_host and origin not in allowed:
                return JSONResponse({"detail": tr("Cross-site request blocked")}, status_code=403)
        return await call_next(request)
