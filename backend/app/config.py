"""Application settings read from the environment and the project root .env file."""

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")


@dataclass(frozen=True)
class Settings:
    """Runtime configuration for the app."""

    jwt_secret: str
    openrouter_api_key: str = ""
    env: str = "development"
    database_url: str = f"sqlite:///{ROOT / 'backend' / 'taskmanager.db'}"
    frontend_dist: Path = ROOT / "frontend" / "dist"
    app_url: str = "http://localhost:8000"
    email_mode: str = "console"
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    google_client_id: str = ""
    google_client_secret: str = ""

    def __post_init__(self) -> None:
        if len(self.jwt_secret) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters")
        if self.email_mode not in ("console", "smtp"):
            raise ValueError("EMAIL_MODE must be 'console' or 'smtp'")

    @property
    def production(self) -> bool:
        return self.env == "production"

    @property
    def google_enabled(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)


def load_settings() -> Settings:
    """Build settings from environment variables; JWT_SECRET is required."""
    d = Settings(jwt_secret="-" * 32)
    env = os.getenv
    return Settings(
        jwt_secret=os.environ["JWT_SECRET"],
        openrouter_api_key=env("OPENROUTER_API_KEY", ""),
        env=env("ENV", d.env),
        database_url=env("DATABASE_URL", d.database_url),
        frontend_dist=Path(env("FRONTEND_DIST", d.frontend_dist)),
        app_url=env("APP_URL", d.app_url).rstrip("/"),
        email_mode=env("EMAIL_MODE", d.email_mode),
        smtp_host=env("SMTP_HOST", d.smtp_host),
        smtp_port=int(env("SMTP_PORT", d.smtp_port)),
        smtp_user=env("SMTP_USER", ""),
        smtp_password=env("SMTP_PASSWORD", ""),
        google_client_id=env("GOOGLE_CLIENT_ID", ""),
        google_client_secret=env("GOOGLE_CLIENT_SECRET", ""),
    )
