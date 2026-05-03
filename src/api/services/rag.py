from __future__ import annotations

import logging

import httpx

from api.config import settings

log = logging.getLogger(__name__)

_TIMEOUT = 8.0


def _base() -> str:
    return f"http://localhost:{settings.obsidian_api_port}"


def _headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {settings.obsidian_api_key}"}


# ── Canonical vault tool interface ──────────────────────────────────────────

async def vault_search(query: str, *, rag_tag: str = "", limit: int = 8) -> list[dict]:
    """Search Obsidian by simple keyword.

    Returns a list of `{filename, context}` dicts. Filters by `rag_tag` (substring
    match against filename or context) when provided. Returns [] on failure or
    when the vault is unreachable — agent must degrade gracefully.
    """
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.post(
                f"{_base()}/search/simple/",
                params={"query": query, "contextLength": 300},
                headers=_headers(),
            )
            if not r.is_success:
                log.warning("vault_search %s: %s", r.status_code, r.text[:200])
                return []
            results: list[dict] = r.json()
    except Exception as exc:
        log.warning("vault_search unreachable: %s", exc)
        return []

    if rag_tag:
        tag = rag_tag.lower()
        results = [
            res for res in results
            if tag in (res.get("filename") or "").lower()
            or tag in (res.get("context") or "").lower()
        ]
    return results[:limit]


async def vault_read(path: str) -> str:
    """Fetch a single vault note by path. Returns '' if missing or unreachable."""
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.get(
                f"{_base()}/vault/{path}",
                headers=_headers(),
            )
            if r.is_success:
                return r.text
            log.warning("vault_read %s: %s", r.status_code, path)
    except Exception as exc:
        log.warning("vault_read unreachable: %s", exc)
    return ""


async def vault_write(path: str, content: str) -> bool:
    """Write (overwrite) a markdown note in the vault at `path`.

    Uses the Obsidian Local REST API PUT endpoint. Returns True on success,
    False on any failure — the agent must degrade gracefully if the vault is
    offline. Caller is responsible for sane path construction (trailing
    `.md`, no leading `/`, no `..`).
    """
    if not path or path.startswith("/") or ".." in path:
        log.warning("vault_write rejected suspicious path: %r", path)
        return False
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.put(
                f"{_base()}/vault/{path}",
                content=content.encode("utf-8"),
                headers={**_headers(), "Content-Type": "text/markdown"},
            )
            if r.is_success:
                return True
            log.warning("vault_write %s: %s", r.status_code, r.text[:200])
    except Exception as exc:
        log.warning("vault_write unreachable: %s", exc)
    return False


async def vault_list_recent(limit: int = 20) -> list[str]:
    """List most-recently-modified vault note paths.

    Uses the Obsidian Local REST API list endpoint. Returns [] on failure.
    Useful for surfacing recent accomplishments / journal entries to the agent.
    """
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.get(f"{_base()}/vault/", headers=_headers())
            if not r.is_success:
                log.warning("vault_list %s", r.status_code)
                return []
            data = r.json()
    except Exception as exc:
        log.warning("vault_list unreachable: %s", exc)
        return []

    files: list[str] = data.get("files", []) if isinstance(data, dict) else []
    return files[:limit]


# ── Backwards-compat shim ───────────────────────────────────────────────────
# `services.linkedin`, `services.resume_engine`, and a few routers still call
# the legacy `search()` returning a pre-formatted prompt block. Keep until they
# are migrated to the agent graph (see src/api/agents/).

async def search(query: str, rag_tag: str, limit: int = 8) -> str:
    """Legacy: returns vault hits formatted for direct prompt injection."""
    hits = await vault_search(query, rag_tag=rag_tag, limit=limit)
    if not hits:
        return ""
    chunks = []
    for res in hits:
        filename = res.get("filename", "")
        context = (res.get("context") or "").strip()
        if context:
            chunks.append(f"[{filename}]\n{context}")
    return "\n\n---\n\n".join(chunks)


async def get_note(path: str) -> str:
    """Legacy alias for `vault_read`."""
    return await vault_read(path)
