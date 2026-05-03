from __future__ import annotations

from typing import Any

from api.services import rag

ToolFn = Any


async def _vault_search(query: str, rag_tag: str = "", limit: int = 8) -> list[dict]:
    return await rag.vault_search(query, rag_tag=rag_tag, limit=limit)


async def _vault_read(path: str) -> str:
    return await rag.vault_read(path)


async def _vault_list_recent(limit: int = 20) -> list[str]:
    return await rag.vault_list_recent(limit=limit)


REGISTRY: dict[str, ToolFn] = {
    "vault_search": _vault_search,
    "vault_read": _vault_read,
    "vault_list_recent": _vault_list_recent,
}


# Anthropic tool-use schema. Surfaced to the model so it can decide when to
# pull from the vault. For the linear agent loop in Phase 1 we still call the
# vault directly from the gather_evidence node — these schemas are here so a
# future tool-using node (Phase 2) can swap in without redefining tools.
SCHEMAS: list[dict] = [
    {
        "name": "vault_search",
        "description": "Keyword-search the user's Obsidian vault. Returns hits with filename and surrounding context.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "rag_tag": {
                    "type": "string",
                    "description": "Filter to notes whose filename or context contains this tag. Empty string for no filter.",
                },
                "limit": {"type": "integer", "default": 8},
            },
            "required": ["query"],
        },
    },
    {
        "name": "vault_read",
        "description": "Read a specific vault note by relative path (e.g. 'projects/apex.md').",
        "input_schema": {
            "type": "object",
            "properties": {"path": {"type": "string"}},
            "required": ["path"],
        },
    },
    {
        "name": "vault_list_recent",
        "description": "List the most recently modified vault note paths.",
        "input_schema": {
            "type": "object",
            "properties": {"limit": {"type": "integer", "default": 20}},
            "required": [],
        },
    },
]


async def call(name: str, args: dict[str, Any]) -> Any:
    """Dispatch a tool call by name."""
    fn = REGISTRY.get(name)
    if fn is None:
        raise KeyError(f"unknown tool: {name}")
    return await fn(**args)
