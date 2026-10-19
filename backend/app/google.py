"""Google sign-in (OpenID Connect) through Authlib."""

from dataclasses import dataclass

from authlib.integrations.starlette_client import OAuth
from fastapi import Request

from app.config import Settings

# Google's published OpenID configuration (https://accounts.google.com/.well-known/openid-configuration)
GOOGLE_METADATA = {
    "issuer": "https://accounts.google.com",
    "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
    "access_token_url": "https://oauth2.googleapis.com/token",
    "jwks_uri": "https://www.googleapis.com/oauth2/v3/certs",
}


@dataclass(frozen=True)
class Identity:
    sub: str
    email: str
    email_verified: bool


def make_oauth(settings: Settings) -> OAuth:
    oauth = OAuth()
    oauth.register(
        name="google",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        client_kwargs={"scope": "openid email profile", "code_challenge_method": "S256"},
        **GOOGLE_METADATA,
    )
    return oauth


def callback_url(request: Request) -> str:
    return f"{request.app.state.settings.app_url}/api/auth/google/callback"


async def login_redirect(request: Request):
    """Redirect to Google; Authlib stores state, nonce and the PKCE verifier in the session."""
    return await request.app.state.oauth.google.authorize_redirect(request, callback_url(request))


async def fetch_identity(request: Request) -> Identity:
    """Check state, exchange the code and verify the ID token (signature, iss, aud, nonce)."""
    token = await request.app.state.oauth.google.authorize_access_token(request)
    info = token["userinfo"]
    return Identity(
        sub=info["sub"],
        email=info["email"].lower(),
        email_verified=bool(info.get("email_verified")),
    )
