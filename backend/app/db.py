"""Database engine setup and the request-scoped session dependency."""

from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import Engine, event
from sqlmodel import Session, create_engine

from app import file_cleanup, models  # noqa: F401  (registers tables and file cleanup hooks)
from app.migrate import migrate


def make_engine(url: str) -> Engine:
    """Create the engine and bring the tables up to date; SQLite gets foreign keys and WAL."""
    if not url.startswith("sqlite"):
        engine = create_engine(url, pool_pre_ping=True)
    else:
        engine = create_engine(url, connect_args={"check_same_thread": False})
        event.listen(engine, "connect", _sqlite_pragmas)
    migrate(engine)
    return engine


def _sqlite_pragmas(dbapi_conn, _record) -> None:
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()


def get_session(request: Request) -> Iterator[Session]:
    """Yield a session bound to the app's engine."""
    with Session(request.app.state.engine, info={"storage": request.app.state.storage}) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]
