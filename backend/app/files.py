"""Upload limits and checks: allowed types by real content, image re-encoding, safe names."""

import io
import re
import zipfile
from dataclasses import dataclass

from fastapi import HTTPException, Request, status
from PIL import Image, ImageOps, UnidentifiedImageError

MB = 1024 * 1024
MAX_ATTACHMENT = 4 * MB
MAX_PER_CARD = 10
QUOTA = 100 * MB
GUEST_QUOTA = 10 * MB
MAX_BACKGROUND_UPLOAD = 10 * MB
MAX_BACKGROUND_STORED = 2 * MB
MAX_PIXELS = 40_000_000
BACKGROUND_EDGE = 2560
FORM_OVERHEAD = 16 * 1024

IMAGES = {"jpg": "JPEG", "jpeg": "JPEG", "png": "PNG", "webp": "WEBP", "gif": "GIF"}
OFFICE = {
    "docx": ("word/", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    "xlsx": ("xl/", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    "pptx": ("ppt/", "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
}
TEXT = {"txt": "text/plain; charset=utf-8", "csv": "text/csv; charset=utf-8"}
ALLOWED = ", ".join(["JPG", "PNG", "WebP", "GIF", "PDF", "TXT", "CSV", "DOCX", "XLSX", "PPTX"])
PRESETS = ("navy", "dusk", "sky", "meadow", "sunrise", "graphite")


@dataclass(frozen=True)
class Checked:
    data: bytes
    content_type: str
    is_image: bool


def _bad(message: str) -> HTTPException:
    return HTTPException(status.HTTP_400_BAD_REQUEST, message)


def require_length(request: Request, limit: int) -> None:
    """Reject uploads without a Content-Length or larger than the limit, before reading them."""
    length = request.headers.get("content-length")
    if length is None:
        raise HTTPException(status.HTTP_411_LENGTH_REQUIRED, "Upload size is required")
    if int(length) > limit + FORM_OVERHEAD:
        raise too_large(limit)


def too_large(limit: int) -> HTTPException:
    return HTTPException(
        status.HTTP_413_CONTENT_TOO_LARGE, f"File is too large. The limit is {limit // MB or 1} MB."
    )


def safe_filename(name: str) -> str:
    """Display name only: last path part, no control characters, at most 120 characters."""
    base = re.split(r"[\\/]", name)[-1]
    base = re.sub(r"[\x00-\x1f\x7f]", "", base).strip().strip(".") or "file"
    return base[-120:]


def check_attachment(name: str, data: bytes) -> Checked:
    """Accept only allowed types, confirmed by content; images are re-encoded without metadata."""
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if ext in IMAGES:
        return _image(data, IMAGES[ext])
    if ext == "pdf":
        if not data.startswith(b"%PDF-"):
            raise _bad("This file is not a valid PDF.")
        return Checked(data, "application/pdf", False)
    if ext in TEXT:
        if b"\x00" in data:
            raise _bad("This file is not plain text.")
        try:
            data.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise _bad("Text files must be UTF-8.") from exc
        return Checked(data, TEXT[ext], False)
    if ext in OFFICE:
        prefix, content_type = OFFICE[ext]
        if not _zip_has(data, prefix):
            raise _bad(f"This file is not a valid {ext.upper()} document.")
        return Checked(data, content_type, False)
    raise _bad(f"This file type isn't allowed. Allowed types: {ALLOWED}.")


def _zip_has(data: bytes, prefix: str) -> bool:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            return any(n.startswith(prefix) for n in z.namelist())
    except zipfile.BadZipFile:
        return False


def _open_image(data: bytes) -> Image.Image:
    try:
        image = Image.open(io.BytesIO(data))
        if image.width * image.height > MAX_PIXELS:
            raise _bad("This image is too large in pixels.")
        image.load()
        return image
    except (UnidentifiedImageError, OSError, SyntaxError, Image.DecompressionBombError) as exc:
        raise _bad("This file is not a valid image.") from exc


def _image(data: bytes, expected: str) -> Checked:
    image = _open_image(data)
    if image.format != expected:
        raise _bad("The image content does not match its file extension.")
    if expected == "GIF":
        return Checked(data, "image/gif", True)
    out = io.BytesIO()
    ImageOps.exif_transpose(image).save(out, expected, quality=90)
    return Checked(out.getvalue(), Image.MIME[expected], True)


def make_background(data: bytes) -> bytes:
    """Re-encode a photo as WebP, at most BACKGROUND_EDGE px per side, without metadata."""
    image = _open_image(data)
    if image.format not in ("JPEG", "PNG", "WEBP"):
        raise _bad("Backgrounds must be JPG, PNG or WebP images.")
    image = ImageOps.exif_transpose(image).convert("RGB")
    image.thumbnail((BACKGROUND_EDGE, BACKGROUND_EDGE))
    for quality in (82, 70, 55):
        out = io.BytesIO()
        image.save(out, "WEBP", quality=quality)
        if out.tell() <= MAX_BACKGROUND_STORED:
            return out.getvalue()
    raise too_large(MAX_BACKGROUND_STORED)
