"""File storage behind a tiny interface: a local folder, or an S3 bucket (Supabase Storage)."""

import re
import uuid
from pathlib import Path
from typing import TYPE_CHECKING, Protocol

from botocore.exceptions import ClientError

if TYPE_CHECKING:
    from app.config import Settings

_KEY = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


class Storage(Protocol):
    def put(self, key: str, data: bytes) -> None: ...
    def get(self, key: str) -> bytes | None: ...
    def delete(self, key: str) -> None: ...


def _checked(key: str) -> str:
    if not _KEY.match(key):
        raise ValueError("Invalid storage key")
    return key


def new_key() -> str:
    """Random storage key; never derived from user input."""
    return uuid.uuid4().hex


class LocalStorage:
    """Files in a folder, one file per key."""

    def __init__(self, root: Path):
        self.root = root
        root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        return self.root / _checked(key)

    def put(self, key: str, data: bytes) -> None:
        self._path(key).write_bytes(data)

    def get(self, key: str) -> bytes | None:
        path = self._path(key)
        return path.read_bytes() if path.is_file() else None

    def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)


class S3Storage:
    """Files as objects in a private S3-compatible bucket, one object per key."""

    def __init__(self, bucket: str, client):
        self.bucket = bucket
        self.client = client

    def put(self, key: str, data: bytes) -> None:
        self.client.put_object(Bucket=self.bucket, Key=_checked(key), Body=data)

    def get(self, key: str) -> bytes | None:
        try:
            return self.client.get_object(Bucket=self.bucket, Key=_checked(key))["Body"].read()
        except ClientError as exc:
            # Supabase sends 404 with an empty error code where AWS sends NoSuchKey.
            if exc.response["ResponseMetadata"]["HTTPStatusCode"] == 404:
                return None
            raise

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=_checked(key))


def make_storage(settings: "Settings") -> Storage:
    """The S3 bucket when one is configured, otherwise the local folder."""
    if not settings.s3_bucket:
        return LocalStorage(settings.storage_dir)
    import boto3
    from botocore.config import Config

    client = boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint,
        region_name=settings.s3_region,
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=settings.s3_secret_access_key,
        config=Config(s3={"addressing_style": "path"}),
    )
    return S3Storage(settings.s3_bucket, client)
