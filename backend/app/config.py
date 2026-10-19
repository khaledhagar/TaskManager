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
    cerebras_api_key: str = ""
    env: str = "development"
    database_url: str = f"sqlite:///{ROOT / 'backend' / 'taskmanager.db'}"
    frontend_dist: Path = ROOT / "frontend" / "dist"

    def __post_init__(self) -> None:
        if len(self.jwt_secret) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters")

    @property
    def production(self) -> bool:
        return self.env == "production"


def load_settings() -> Settings:
    """Build settings from environment variables; JWT_SECRET is required."""
    defaults = Settings(jwt_secret="-" * 32)
    return Settings(
        jwt_secret=os.environ["JWT_SECRET"],
        cerebras_api_key=os.getenv("CEREBRAS_API_KEY", ""),
        env=os.getenv("ENV", defaults.env),
        database_url=os.getenv("DATABASE_URL", defaults.database_url),
        frontend_dist=Path(os.getenv("FRONTEND_DIST", defaults.frontend_dist)),
    )
