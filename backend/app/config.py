"""Application settings read from the environment and the project root .env file."""

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

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
    storage_dir: Path = ROOT / "backend" / "storage"
    app_url: str = "http://localhost:8000"
    email_mode: str = "console"
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    google_client_id: str = ""
    google_client_secret: str = ""
    allowed_hosts: tuple[str, ...] = ()
    # Protects the scheduled-job endpoints; empty turns them off (SEC-204).
    cron_secret: str = ""
    # S3-compatible bucket for uploaded files (Supabase Storage); empty uses `storage_dir`.
    s3_endpoint: str = ""
    s3_region: str = ""
    s3_bucket: str = ""
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    # Vercel sets VERCEL=1; its proxy puts the visitor's real address in x-real-ip.
    on_vercel: bool = False

    def __post_init__(self) -> None:
        if len(self.jwt_secret) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters")
        if self.env not in ("development", "production"):
            raise ValueError("ENV must be 'development' or 'production'")
        if self.production and not self.allowed_hosts:
            raise ValueError("ALLOWED_HOSTS (or APP_URL) must name the site's host in production")
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
    app_url = env("APP_URL", d.app_url).rstrip("/")
    hosts = env("ALLOWED_HOSTS") or urlparse(app_url).hostname or ""
    # Vercel Cron calls the deployment's own address, which Vercel puts in VERCEL_URL.
    hosts = ",".join(filter(None, [hosts, env("VERCEL_URL")]))
    return Settings(
        jwt_secret=os.environ["JWT_SECRET"],
        openrouter_api_key=env("OPENROUTER_API_KEY", ""),
        env=env("ENV", d.env),
        database_url=env("DATABASE_URL", d.database_url),
        # A relative FRONTEND_DIST is inside backend/ (Vercel builds the website there).
        frontend_dist=Path(__file__).resolve().parents[1]
        / env("FRONTEND_DIST", str(d.frontend_dist)),
        storage_dir=Path(env("STORAGE_DIR", d.storage_dir)),
        app_url=app_url,
        email_mode=env("EMAIL_MODE", d.email_mode),
        smtp_host=env("SMTP_HOST", d.smtp_host),
        smtp_port=int(env("SMTP_PORT", d.smtp_port)),
        smtp_user=env("SMTP_USER", ""),
        smtp_password=env("SMTP_PASSWORD", ""),
        google_client_id=env("GOOGLE_CLIENT_ID", ""),
        google_client_secret=env("GOOGLE_CLIENT_SECRET", ""),
        allowed_hosts=tuple(h.strip() for h in hosts.split(",") if h.strip()),
        cron_secret=env("CRON_SECRET", ""),
        s3_endpoint=env("S3_ENDPOINT", ""),
        s3_region=env("S3_REGION", ""),
        s3_bucket=env("S3_BUCKET", ""),
        s3_access_key_id=env("S3_ACCESS_KEY_ID", ""),
        s3_secret_access_key=env("S3_SECRET_ACCESS_KEY", ""),
        on_vercel=env("VERCEL") == "1",
    )
