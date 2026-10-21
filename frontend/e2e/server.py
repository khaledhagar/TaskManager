"""Server for the Playwright tests: the real app on a fresh database, plus test-only helpers.

Run from `backend/`: `uv run python ../frontend/e2e/server.py`. The app itself is unchanged; this
file only raises the rate limits (one test machine is one IP), points Google sign-in at a fake
OpenID provider, and adds `/__e2e` routes that read the console outbox and pick the Google user.
"""

import os
import secrets
import shutil
import sys
import tempfile
import time
from pathlib import Path

import uvicorn
from authlib.jose import JsonWebKey, jwt
from fastapi import FastAPI, Form
from fastapi.responses import RedirectResponse

PORT = 8001
BASE = f"http://127.0.0.1:{PORT}"
ISSUER = f"{BASE}/__e2e/google"
# Outside the project: OneDrive turns new folders into placeholders that cannot be deleted.
DATA = Path(tempfile.gettempdir()) / "taskmanager-e2e"

shutil.rmtree(DATA, ignore_errors=True)
DATA.mkdir()
os.environ |= {
    "APP_URL": BASE,
    "ENV": "development",
    "EMAIL_MODE": "console",
    "DATABASE_URL": f"sqlite:///{DATA / 'e2e.db'}",
    "STORAGE_DIR": str(DATA / "storage"),
    "GOOGLE_CLIENT_ID": "e2e-client",
    "GOOGLE_CLIENT_SECRET": "e2e-secret",
}
sys.path.insert(0, os.getcwd())

from app import google, ratelimit  # noqa: E402
from app.config import load_settings  # noqa: E402
from app.factory import create_app  # noqa: E402

for name in ("SIGN_IN", "GUEST", "EMAIL_PER_ADDRESS", "EMAIL_PER_IP", "AI_PER_MINUTE", "UPLOADS"):
    setattr(ratelimit, name, ratelimit.Limit(10_000, 60))
google.GOOGLE_METADATA = {
    "issuer": ISSUER,
    "authorize_url": f"{ISSUER}/authorize",
    "access_token_url": f"{ISSUER}/token",
    "jwks_uri": f"{ISSUER}/jwks",
}

app = create_app(load_settings())
tools = FastAPI()
key = JsonWebKey.generate_key("RSA", 2048, is_private=True, options={"kid": "e2e"})
codes: dict[str, dict] = {}
next_identity = {"email": "google.user@example.com", "sub": "google-1"}


@tools.get("/outbox")
def outbox(to: str) -> dict:
    """The newest console email sent to `to`."""
    mail = [m for m in app.state.mailer.outbox if m.to == to]
    return {"subject": mail[-1].subject, "text": mail[-1].text} if mail else {}


@tools.post("/google/identity")
def set_identity(identity: dict) -> dict:
    next_identity.update(identity)
    return next_identity


@tools.get("/google/authorize")
def authorize(redirect_uri: str, state: str, nonce: str) -> RedirectResponse:
    code = secrets.token_urlsafe(16)
    codes[code] = {"nonce": nonce, **next_identity}
    return RedirectResponse(f"{redirect_uri}?code={code}&state={state}")


@tools.post("/google/token")
def token(code: str = Form()) -> dict:
    who = codes.pop(code)
    now = int(time.time())
    claims = {
        "iss": ISSUER,
        "aud": "e2e-client",
        "sub": who["sub"],
        "email": who["email"],
        "email_verified": True,
        "nonce": who["nonce"],
        "iat": now,
        "exp": now + 600,
    }
    id_token = jwt.encode({"alg": "RS256", "kid": "e2e"}, claims, key).decode()
    return {"access_token": "e2e", "token_type": "Bearer", "expires_in": 600, "id_token": id_token}


@tools.get("/google/jwks")
def jwks() -> dict:
    return {"keys": [key.as_dict(is_private=False)]}


server = FastAPI()
server.mount("/__e2e", tools)
server.mount("/", app)

if __name__ == "__main__":
    uvicorn.run(server, host="127.0.0.1", port=PORT, log_level="warning")
