from __future__ import annotations

import logging

import httpx

from api.config import settings

log = logging.getLogger(__name__)


def _base() -> str:
    return f"http://localhost:{settings.obsidian_api_port}"


async def search(query: str, rag_tag: str, limit: int = 8) -> str:
    """
    Query the Obsidian Local REST API for notes tagged with `rag_tag`.
    Returns a formatted string ready for injection into a prompt context block.
    Falls back to empty string if Obsidian is unreachable.
    """
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.post(
                f"{_base()}/search/simple/",
                params={"query": query, "contextLength": 300},
                headers={"Authorization": f"Bearer {settings.obsidian_api_port}"},
            )
            if not r.is_success:
                log.warning("Obsidian search returned %s", r.status_code)
                return ""
            results: list[dict] = r.json()
    except Exception as exc:
        log.warning("Obsidian unreachable: %s", exc)
        return ""

    # Filter to notes that mention the rag_tag (by filename or content)
    filtered = [
        res for res in results
        if rag_tag.lower() in (res.get("filename") or "").lower()
        or rag_tag.lower() in (res.get("context") or "").lower()
    ][:limit]

    if not filtered:
        return ""

    chunks = []
    for res in filtered:
        filename = res.get("filename", "")
        context = (res.get("context") or "").strip()
        if context:
            chunks.append(f"[{filename}]\n{context}")

    return "\n\n---\n\n".join(chunks)


async def get_note(path: str) -> str:
    """Fetch a specific vault note by path."""
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(
                f"{_base()}/vault/{path}",
                headers={"Authorization": f"Bearer {settings.obsidian_api_port}"},
            )
            if r.is_success:
                return r.text
    except Exception as exc:
        log.warning("Obsidian get_note failed: %s", exc)
    return ""
