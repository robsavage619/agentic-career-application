from __future__ import annotations

from mcp.server.fastmcp import FastMCP

from api.services import rag


def register(mcp: FastMCP) -> None:
    @mcp.tool()
    async def vault_search(query: str, rag_tag: str = "", limit: int = 8) -> list[dict]:
        """Keyword search Rob's Obsidian vault.

        Returns a list of `{filename, context}` dicts. `rag_tag` is a substring
        filter applied to filename or surrounding context. Returns [] when the
        vault is unreachable — degrade gracefully, never raise.
        """
        return await rag.vault_search(query, rag_tag=rag_tag, limit=limit)

    @mcp.tool()
    async def vault_read(path: str) -> str:
        """Fetch a single vault note's markdown by path (e.g. `wiki/index.md`).

        Returns '' if the note is missing or the vault is unreachable.
        """
        return await rag.vault_read(path)

    @mcp.tool()
    async def vault_list_recent(limit: int = 20) -> list[str]:
        """List the most-recently-modified vault note paths.

        Useful for surfacing recent journal entries / accomplishments.
        """
        return await rag.vault_list_recent(limit=limit)

    @mcp.tool()
    async def vault_write(path: str, content: str, confirm: bool = False) -> bool:
        """Write (overwrite) a markdown note in the vault at `path`.

        Set `confirm=True` to actually write — without it the call is a no-op
        that returns False. This is a guardrail against accidental writes
        from the chat: Claude must explicitly opt in to mutation.

        Path must be a relative `.md` path with no leading `/` and no `..`.
        """
        if not confirm:
            return False
        return await rag.vault_write(path, content)
