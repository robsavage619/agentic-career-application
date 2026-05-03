from __future__ import annotations

import logging
from collections.abc import AsyncIterator

import anthropic

from api.config import settings

log = logging.getLogger(__name__)

_client: anthropic.AsyncAnthropic | None = None


def get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


async def complete(
    *,
    system_persona: str,
    rag_context: str,
    user_prompt: str,
    model: str = "claude-haiku-4-5-20251001",
    max_tokens: int = 2048,
) -> str:
    """Single-shot completion with cached persona + RAG context blocks."""
    client = get_client()
    system: list[dict] = [
        {
            "type": "text",
            "text": system_persona,
            "cache_control": {"type": "ephemeral"},
        },
    ]
    if rag_context:
        system.append(
            {
                "type": "text",
                "text": f"<vault_context>\n{rag_context}\n</vault_context>",
                "cache_control": {"type": "ephemeral"},
            }
        )

    msg = await client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system,  # type: ignore[arg-type]
        messages=[{"role": "user", "content": user_prompt}],
    )
    return msg.content[0].text  # type: ignore[index,union-attr]


async def stream(
    *,
    system_persona: str,
    rag_context: str,
    user_prompt: str,
    model: str = "claude-sonnet-4-6",
    max_tokens: int = 4096,
) -> AsyncIterator[str]:
    """
    Streaming completion. Yields text deltas as SSE-ready strings.
    Caller is responsible for wrapping in a StreamingResponse.
    """
    client = get_client()
    system: list[dict] = [
        {
            "type": "text",
            "text": system_persona,
            "cache_control": {"type": "ephemeral"},
        },
    ]
    if rag_context:
        system.append(
            {
                "type": "text",
                "text": f"<vault_context>\n{rag_context}\n</vault_context>",
                "cache_control": {"type": "ephemeral"},
            }
        )

    async with client.messages.stream(
        model=model,
        max_tokens=max_tokens,
        system=system,  # type: ignore[arg-type]
        messages=[{"role": "user", "content": user_prompt}],
    ) as s:
        async for delta in s.text_stream:
            yield delta
