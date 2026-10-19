"""ASGI entry point: `uv run fastapi run app/main.py`."""

from app.config import load_settings
from app.factory import create_app

app = create_app(load_settings())
