"""Live smoke test against the real free model (T-120). Run with: uv run pytest -m live"""

import pytest

from app import ai
from app.assistant import ChecklistDraft
from app.config import load_settings

pytestmark = pytest.mark.live


def test_live_structured_reply():
    messages = [
        {"role": "system", "content": "Return 3 short checklist items. No emojis."},
        {"role": "user", "content": "Card: Design pricing page"},
    ]
    result = ai.complete(messages, ChecklistDraft, load_settings().openrouter_api_key)
    assert 1 <= len(result.items) <= 10
    assert all(isinstance(i, str) and i.strip() for i in result.items)
