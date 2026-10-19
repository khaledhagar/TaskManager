"""File storage behind a tiny interface. Local folder now; an S3 version is added at deployment."""

import re
import uuid
from pathlib import Path
from typing import Protocol

_KEY = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


class Storage(Protocol):
    def put(self, key: str, data: bytes) -> None: ...
    def get(self, key: str) -> bytes | None: ...
    def delete(self, key: str) -> None: ...


def new_key() -> str:
    """Random storage key; never derived from user input."""
    return uuid.uuid4().hex


class LocalStorage:
    """Files in a folder, one file per key."""

    def __init__(self, root: Path):
        self.root = root
        root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        if not _KEY.match(key):
            raise ValueError("Invalid storage key")
        return self.root / key

    def put(self, key: str, data: bytes) -> None:
        self._path(key).write_bytes(data)

    def get(self, key: str) -> bytes | None:
        path = self._path(key)
        return path.read_bytes() if path.is_file() else None

    def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)
