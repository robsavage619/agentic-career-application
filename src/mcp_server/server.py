from __future__ import annotations

import logging

from mcp.server.fastmcp import FastMCP

from mcp_server.tools import read as read_tools
from mcp_server.tools import vault as vault_tools
from mcp_server.tools import write as write_tools

log = logging.getLogger(__name__)

mcp = FastMCP("career-command-center")

vault_tools.register(mcp)
read_tools.register(mcp)
write_tools.register(mcp)
