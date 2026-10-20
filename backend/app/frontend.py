"""Serve the statically built frontend with single-page-app fallback."""

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.i18n import tr


def mount_frontend(app: FastAPI, dist: Path) -> None:
    """Serve files from `dist`, falling back to index.html for client routes."""
    dist = dist.resolve()
    app.mount("/assets", StaticFiles(directory=dist / "assets", check_dir=False), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        if path == "api" or path.startswith("api/"):
            raise HTTPException(status_code=404, detail=tr("Not found"))
        file = (dist / path).resolve()
        if path and file.is_file() and file.is_relative_to(dist):
            return FileResponse(file)
        return FileResponse(dist / "index.html")
