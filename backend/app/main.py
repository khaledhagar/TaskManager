"""ASGI entry point: `uv run fastapi run app/main.py`."""

import logging

from app.config import load_settings
from app.factory import create_app

# Show the app's own INFO logs (console-mode email links in development); others stay at WARNING.
logging.basicConfig(format="%(levelname)s:     %(name)s: %(message)s")
logging.getLogger("taskmanager").setLevel(logging.INFO)

app = create_app(load_settings())
