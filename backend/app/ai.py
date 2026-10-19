"""LLM calls via LiteLLM and OpenRouter free models, with friendly errors."""

from fastapi import HTTPException, status
from litellm import completion
from openai import APIError, RateLimitError
from pydantic import BaseModel, ValidationError

MODEL = "openrouter/nvidia/nemotron-3.5-super-vl:free"
BACKUP_MODEL = "nvidia/nemotron-3-super-120b-a12b:free"
MAX_TOKENS = 1500
TIMEOUT = 60

LIMIT_MESSAGE = "The AI assistant is busy or today's free limit is reached. Please try again later."
UNAVAILABLE_MESSAGE = "The AI assistant is unavailable right now. Please try again."
BAD_ANSWER_MESSAGE = "The AI assistant returned an unexpected answer. Please try again."


def complete[T: BaseModel](messages: list[dict], schema: type[T], api_key: str) -> T:
    """Ask the model for a structured answer and parse it into `schema`."""
    try:
        response = completion(
            model=MODEL,
            messages=messages,
            response_format=schema,
            max_tokens=MAX_TOKENS,
            timeout=TIMEOUT,
            api_key=api_key,
            extra_body={"models": [MODEL.removeprefix("openrouter/"), BACKUP_MODEL]},
        )
    except RateLimitError as exc:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, LIMIT_MESSAGE) from exc
    except APIError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, UNAVAILABLE_MESSAGE) from exc
    try:
        return schema.model_validate_json(response.choices[0].message.content or "")
    except ValidationError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, BAD_ANSWER_MESSAGE) from exc
