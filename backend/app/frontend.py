"""Serve the statically built frontend with single-page-app fallback."""

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.gzip import GZipMiddleware

from app.i18n import tr


class AssetFiles(StaticFiles):
    """Vite's hashed assets never change, so browsers may keep them for a year."""

    def file_response(self, *args, **kwargs):
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


def mount_frontend(app: FastAPI, dist: Path) -> None:
    """Serve files from `dist`, falling back to index.html for client routes.

    Only the static assets are gzipped; API responses are not (they mix secrets and user input).
    """
    dist = dist.resolve()
    assets = AssetFiles(directory=dist / "assets", check_dir=False)
    app.mount("/assets", GZipMiddleware(assets), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        if path == "api" or path.startswith("api/"):
            raise HTTPException(status_code=404, detail=tr("Not found"))
        file = (dist / path).resolve()
        if not (path and file.is_file() and file.is_relative_to(dist)):
            file = dist / "index.html"
        return FileResponse(file, headers={"Cache-Control": "no-cache"})
