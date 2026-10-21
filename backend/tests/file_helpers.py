"""Sample files and upload helpers shared by the file tests."""

import io
import zipfile

from PIL import Image

from app.storage import LocalStorage


def png(size=(40, 30), color="red") -> bytes:
    out = io.BytesIO()
    Image.new("RGB", size, color).save(out, "PNG")
    return out.getvalue()


def jpeg_with_gps(size=(3000, 2000)) -> bytes:
    image = Image.new("RGB", size, "blue")
    exif = Image.Exif()
    exif[0x8825] = {1: "N", 2: (30.0, 0.0, 0.0)}  # GPSInfo
    exif[0x010F] = "Camera Maker"
    out = io.BytesIO()
    image.save(out, "JPEG", exif=exif.tobytes())
    return out.getvalue()


def docx() -> bytes:
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as z:
        z.writestr("[Content_Types].xml", "<Types/>")
        z.writestr("word/document.xml", "<w:document/>")
    return out.getvalue()


PDF = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"


def upload(client, card_id, name, data, ctype="application/octet-stream", **kw):
    return client.post(
        f"/api/cards/{card_id}/attachments", files={"file": (name, data, ctype)}, **kw
    )


def storage(client) -> LocalStorage:
    return client.app.state.storage
