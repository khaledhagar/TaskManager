---
name: Cerebras Inference
description: Use this to write code to call an LLM using LiteLLM with the Cerebras API directly
---

# Calling an LLM via Cerebras

These instructions allow you to write code that calls an LLM on Cerebras.
This method uses LiteLLM with the Cerebras API directly (no OpenRouter).

## Setup

The CEREBRAS_API_KEY must be set in the .env file and loaded in as an environment variable.
Get a free key at https://cloud.cerebras.ai.

The uv project must include litellm and pydantic.
`uv add litellm pydantic`

## Code snippets

Use code like these examples in order to use Cerebras.

### Imports and constants

```python
from litellm import completion
MODEL = "cerebras/gpt-oss-120b"
MAX_TOKENS = 2000
```

Always pass `max_tokens` and `reasoning_effort="low"` to keep answers fast and free-tier usage low.

### Code to call via Cerebras for a text response

```python
response = completion(model=MODEL, messages=messages, reasoning_effort="low", max_tokens=MAX_TOKENS)
result = response.choices[0].message.content
```

### Code to call via Cerebras for a Structured Outputs response

```python
response = completion(model=MODEL, messages=messages, response_format=MyBaseModelSubclass, reasoning_effort="low", max_tokens=MAX_TOKENS)
result = response.choices[0].message.content
result_as_object = MyBaseModelSubclass.model_validate_json(result)
```
