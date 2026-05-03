from __future__ import annotations

import logging

from mcp.server.fastmcp import FastMCP

from mcp_server.tools import vault as vault_tools

log = logging.getLogger(__name__)

mcp = FastMCP("career-command-center")

vault_tools.register(mcp)
