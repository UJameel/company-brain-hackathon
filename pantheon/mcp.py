"""Scalekit Virtual MCP server for Pantheon's write tools (Hephaestus).

One server, two tools, least privilege: any MCP client (Claude Code, Cursor) can connect
with a per-user session token and act in Slack/GitHub AS that user. The URL is static;
the token is minted per user per run and expires."""
from __future__ import annotations

from datetime import timedelta

from . import config
from .mnemosyne import _actions

SERVER_NAME = "pantheon-hephaestus"
TOOLS = {config.SLACK_CONNECTION: ["slack_send_message", "slack_fetch_conversation_history"],
         config.GITHUB_CONNECTION: ["github_issue_create", "github_issues_list"]}


def ensure_server() -> tuple[str, str]:
    actions = _actions()
    for cfg in getattr(actions.mcp.list_configs(), "configs", []):
        if cfg.name == SERVER_NAME:
            return cfg.id, cfg.mcp_server_url
    from scalekit.actions.models.mcp_config import McpConfigConnectionToolMapping

    mappings = [McpConfigConnectionToolMapping(connection_name=c, tools=t) for c, t in TOOLS.items()]
    res = actions.mcp.create_config(name=SERVER_NAME, description="Pantheon's action tools, exposed per user", connection_tool_mappings=mappings)
    cfg = getattr(res, "config", res)
    return cfg.id, cfg.mcp_server_url


def session_token(user_key: str, hours: int = 1) -> dict:
    cfg_id, url = ensure_server()
    tok = _actions().mcp.create_session_token(mcp_config_id=cfg_id, identifier=config.USERS[user_key], expiry=timedelta(hours=hours))
    return {"mcp_server_url": url, "config_id": cfg_id, "as_user": config.USERS[user_key], "token": getattr(tok, "token", None) or getattr(tok, "session_token", None) or str(tok)}
