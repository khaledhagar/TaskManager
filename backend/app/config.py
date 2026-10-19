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

    @property
    def production(self) -> bool:
        return self.env == "production"


def load_settings() -> Settings:
    """Build settings from environment variables; JWT_SECRET is required."""
    defaults = Settings(jwt_secret="")
    return Settings(
        jwt_secret=os.environ["JWT_SECRET"],
        openrouter_api_key=os.getenv("OPENROUTER_API_KEY", ""),
        env=os.getenv("ENV", defaults.env),
        database_url=os.getenv("DATABASE_URL", defaults.database_url),
        frontend_dist=Path(os.getenv("FRONTEND_DIST", defaults.frontend_dist)),
    )
