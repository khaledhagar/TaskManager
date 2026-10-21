"""The complete() helper: free models, bad output and friendly provider errors (T-110, T-111)."""

from types import SimpleNamespace

import litellm
import pytest
from fastapi import HTTPException
from helpers import first_board, sign_up

from app import ai
from app.assistant import ChecklistDraft


@pytest.fixture
def user(client):
    sign_up(client)
    return client


@pytest.fixture
def board(user):
    return first_board(user)


# --- the complete() helper ----------------------------------------------------


def fake_response(content):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])


def test_complete_calls_free_model_with_backup(monkeypatch):
    seen = {}

    def fake_completion(**kwargs):
        seen.update(kwargs)
        return fake_response('{"items": ["a"]}')

    monkeypatch.setattr(ai, "completion", fake_completion)
    result = ai.complete([{"role": "user", "content": "x"}], ChecklistDraft, "key")
    assert result == ChecklistDraft(items=["a"])
    assert seen["model"] == "openrouter/nvidia/nemotron-3.5-super-vl:free"
    assert seen["extra_body"] == {
        "models": ["nvidia/nemotron-3.5-super-vl:free", "nvidia/nemotron-3-super-120b-a12b:free"]
    }
    assert seen["max_tokens"] == ai.MAX_TOKENS
    assert seen["response_format"] is ChecklistDraft
    assert seen["api_key"] == "key"
    assert seen["timeout"] == ai.TIMEOUT


@pytest.mark.parametrize("content", ["not json", '{"wrong": 1}', None])
def test_complete_bad_output_is_502(monkeypatch, content):
    monkeypatch.setattr(ai, "completion", lambda **_: fake_response(content))
    with pytest.raises(HTTPException) as err:
        ai.complete([], ChecklistDraft, "key")
    assert err.value.status_code == 502


def raiser(exc):
    def fake_completion(**_):
        raise exc

    return fake_completion


def test_complete_rate_limit_is_friendly_429(monkeypatch):
    exc = litellm.RateLimitError("free-models-per-day", llm_provider="openrouter", model="m")
    monkeypatch.setattr(ai, "completion", raiser(exc))
    with pytest.raises(HTTPException) as err:
        ai.complete([], ChecklistDraft, "key")
    assert err.value.status_code == 429
    assert err.value.detail == ai.LIMIT_MESSAGE
    assert "free-models-per-day" not in err.value.detail


@pytest.mark.parametrize(
    "exc",
    [
        litellm.Timeout("slow", model="m", llm_provider="openrouter"),
        litellm.APIConnectionError("secret-provider-detail", llm_provider="openrouter", model="m"),
        litellm.ServiceUnavailableError("down", llm_provider="openrouter", model="m"),
    ],
)
def test_complete_provider_errors_are_friendly_502(monkeypatch, exc):
    monkeypatch.setattr(ai, "completion", raiser(exc))
    with pytest.raises(HTTPException) as err:
        ai.complete([], ChecklistDraft, "key")
    assert err.value.status_code == 502
    assert err.value.detail == ai.UNAVAILABLE_MESSAGE


def test_route_returns_friendly_error_json(user, board, monkeypatch):
    exc = litellm.RateLimitError("raw provider text", llm_provider="openrouter", model="m")
    monkeypatch.setattr(ai, "completion", raiser(exc))
    card_id = board["columns"][0]["cards"][0]["id"]
    r = user.post(f"/api/ai/cards/{card_id}/checklist")
    assert r.status_code == 429
    assert r.json() == {"detail": ai.LIMIT_MESSAGE}
