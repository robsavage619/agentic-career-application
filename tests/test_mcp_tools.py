"""MCP server tool surface.

Phase 1 contract: the MCP server exposes the four canonical vault primitives.
The chat-window agent (Claude Code) needs all four to plan + retrieve + write.

Also enforces the vault-everywhere principle at the MCP boundary: `vault_search`
must always be advertised — no advisory workflow can be built without it.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from mcp_server.server import mcp


@pytest.mark.parametrize(
    "tool_name",
    ["vault_search", "vault_read", "vault_list_recent", "vault_write"],
)
async def test_vault_tool_registered(tool_name: str) -> None:
    tools = await mcp.list_tools()
    names = {t.name for t in tools}
    assert tool_name in names, f"MCP server missing required tool: {tool_name}"


async def test_vault_search_delegates_to_rag() -> None:
    fake_hits = [{"filename": "wiki/index.md", "context": "vault entry"}]
    with patch(
        "mcp_server.tools.vault.rag.vault_search",
        new=AsyncMock(return_value=fake_hits),
    ) as vs:
        result = await mcp.call_tool(
            "vault_search",
            {"query": "rag eval", "rag_tag": "rob", "limit": 5},
        )

    vs.assert_awaited_once_with("rag eval", rag_tag="rob", limit=5)
    # FastMCP returns (content_list, structured_dict) for tools with structured output.
    structured = result[1] if isinstance(result, tuple) else result
    payload = structured.get("result") if isinstance(structured, dict) else structured
    assert payload == fake_hits


async def test_vault_write_requires_confirm() -> None:
    with patch(
        "mcp_server.tools.vault.rag.vault_write",
        new=AsyncMock(return_value=True),
    ) as vw:
        result = await mcp.call_tool(
            "vault_write",
            {"path": "wiki/test.md", "content": "hello"},
        )

    vw.assert_not_awaited()
    structured = result[1] if isinstance(result, tuple) else result
    payload = structured.get("result") if isinstance(structured, dict) else structured
    assert payload is False


async def test_vault_write_with_confirm_writes() -> None:
    with patch(
        "mcp_server.tools.vault.rag.vault_write",
        new=AsyncMock(return_value=True),
    ) as vw:
        result = await mcp.call_tool(
            "vault_write",
            {"path": "wiki/test.md", "content": "hello", "confirm": True},
        )

    vw.assert_awaited_once_with("wiki/test.md", "hello")
    structured = result[1] if isinstance(result, tuple) else result
    payload = structured.get("result") if isinstance(structured, dict) else structured
    assert payload is True
