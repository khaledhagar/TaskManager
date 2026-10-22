"""S3-compatible file storage (Supabase Storage in production, Phase 28)."""

import pytest
from botocore.exceptions import ClientError

from app.config import Settings
from app.storage import LocalStorage, S3Storage, make_storage


class FakeS3:
    """The three S3 calls the app makes, kept in a dict."""

    def __init__(self):
        self.objects: dict[tuple[str, str], bytes] = {}

    def put_object(self, Bucket, Key, Body):  # noqa: N803 (boto3 argument names)
        self.objects[(Bucket, Key)] = Body

    def get_object(self, Bucket, Key):  # noqa: N803
        if (Bucket, Key) not in self.objects:
            # Supabase Storage answers a missing object with status 404 and an empty code.
            raise ClientError(
                {"Error": {"Code": ""}, "ResponseMetadata": {"HTTPStatusCode": 404}}, "GetObject"
            )
        return {"Body": FakeBody(self.objects[(Bucket, Key)])}

    def delete_object(self, Bucket, Key):  # noqa: N803
        self.objects.pop((Bucket, Key), None)


class FakeBody:
    def __init__(self, data):
        self.data = data

    def read(self):
        return self.data


def test_put_get_delete_in_the_bucket():
    s3 = FakeS3()
    store = S3Storage("files", s3)
    store.put("abc123", b"hello")
    assert s3.objects == {("files", "abc123"): b"hello"}
    assert store.get("abc123") == b"hello"
    store.delete("abc123")
    assert store.get("abc123") is None


def test_keys_are_checked_like_the_local_folder():
    with pytest.raises(ValueError):
        S3Storage("files", FakeS3()).put("../x", b"")


def test_other_s3_errors_are_not_hidden():
    class Broken(FakeS3):
        def get_object(self, Bucket, Key):  # noqa: N803
            raise ClientError(
                {"Error": {"Code": "AccessDenied"}, "ResponseMetadata": {"HTTPStatusCode": 403}},
                "GetObject",
            )

    with pytest.raises(ClientError):
        S3Storage("files", Broken()).get("abc")


def test_settings_choose_the_storage(tmp_path):
    local = Settings(jwt_secret="x" * 32, storage_dir=tmp_path)
    assert isinstance(make_storage(local), LocalStorage)
    s3 = Settings(
        jwt_secret="x" * 32,
        s3_endpoint="https://ref.storage.supabase.co/storage/v1/s3",
        s3_region="eu-west-1",
        s3_bucket="files",
        s3_access_key_id="id",
        s3_secret_access_key="secret",
    )
    store = make_storage(s3)
    assert isinstance(store, S3Storage)
    assert store.bucket == "files"
