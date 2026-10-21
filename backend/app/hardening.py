"""Security headers, request size limit, trusted hosts and a generic error answer."""

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.config import Settings
from app.i18n import tr

log = logging.getLogger("taskmanager")

MAX_BODY = 1024 * 1024
HEADERS = {
    "Content-Security-Policy": (
        "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; "
        "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    ),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(self), geolocation=()",
}
HSTS = "max-age=31536000; includeSubDomains"


def add_hardening(app: FastAPI, settings: Settings) -> None:
    """Headers on every response (routes may set stricter ones), 1 MB JSON bodies, no stack traces.

    Uploads (multipart) are exempt from the body limit: their routes enforce their own limits.
    Add it before the language middleware so error messages are translated.
    """
    headers = HEADERS | ({"Strict-Transport-Security": HSTS} if settings.production else {})

    @app.middleware("http")
    async def harden(request: Request, call_next):
        length = int(request.headers.get("content-length") or 0)
        multipart = request.headers.get("content-type", "").startswith("multipart/form-data")
        if length > MAX_BODY and not multipart:
            response = JSONResponse({"detail": tr("The request is too large.")}, status_code=413)
        else:
            try:
                response = await call_next(request)
            except Exception:
                log.exception("Unhandled error on %s %s", request.method, request.url.path)
                detail = tr("Something went wrong on our side. Please try again.")
                response = JSONResponse({"detail": detail}, status_code=500)
        for name, value in headers.items():
            response.headers.setdefault(name, value)
        return response

    if settings.production:
        app.add_middleware(TrustedHostMiddleware, allowed_hosts=list(settings.allowed_hosts))
