"""Hephaestus (motor cortex): acts in the user's tools, as the user, through Scalekit.

Every write goes through execute_tool with the acting user's identifier, never a shared
bot token. Without Scalekit credentials the action is drafted and returned as a dry run,
so the eval can still score 'expected_action'. Destructive tools are never exposed."""
from __future__ import annotations

from . import config, llm

ALLOWED_WRITES = {"slack_send_message", "github_issue_create"}

DRAFT_SYSTEM = """You are Hephaestus, the action agent of a company brain. Given the user's
request and Athena's answer, produce ONLY the body of the message or issue to send, in
plain text, under 60 words, friendly and specific. No preamble."""


def draft(question: str, answer: str, usage: llm.Usage) -> str:
    return llm.complete("draft", DRAFT_SYSTEM, f"Request: {question}\n\nWhat the brain knows: {answer}", usage=usage, max_tokens=200)


def act(user_key: str, tool_name: str, tool_input: dict, connection_name: str, dry_run: bool) -> dict:
    if tool_name not in ALLOWED_WRITES:
        return {"tool": tool_name, "status": "refused", "reason": "not in Hephaestus' allow-list"}
    identifier = config.USERS[user_key]
    if dry_run or not config.scalekit_configured():
        return {"tool": tool_name, "status": "dry-run", "as_user": identifier, "input": tool_input}
    from .mnemosyne import _actions

    res = _actions().execute_tool(tool_name=tool_name, tool_input=tool_input, connection_name=connection_name, identifier=identifier)
    return {"tool": tool_name, "status": "executed", "as_user": identifier, "input": tool_input, "result": str(res.data)[:300]}
