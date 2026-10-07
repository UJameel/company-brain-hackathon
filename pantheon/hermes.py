"""Hermes (thalamus): the relay. Receives a request, identifies the user, decides which
agents run and which model each step uses, and streams the activity feed. Every run is
one Respan workflow; every agent step is a traced task."""
from __future__ import annotations

import json
import time

from . import cerberus, athena, hephaestus, llm, config

try:
    from respan import Respan, workflow, task

    if config.RESPAN_API_KEY:
        Respan(api_key=config.RESPAN_API_KEY, app_name="pantheon")
except Exception:  # tracing is optional; the brain still works

    def workflow(name=None, **_):
        return lambda f: f

    def task(name=None, **_):
        return lambda f: f


ROUTE_SYSTEM = """Classify the request for a company brain. Reply with JSON only:
{"intent": "question" | "action", "action_tool": null | "slack_send_message" | "githubpat_issue_create",
 "target_channel": null | "#channel-name"}.
"action" means the user asks to send, post, draft a message, or open an issue."""


@task(name="hermes.route")
def route(question: str, usage: llm.Usage) -> dict:
    raw = llm.complete("route", ROUTE_SYSTEM, question, usage=usage, max_tokens=80)
    try:
        return json.loads(raw[raw.find("{") : raw.rfind("}") + 1])
    except Exception:
        return {"intent": "question", "action_tool": None, "target_channel": None}


@task(name="cerberus.scope")
async def _scope(user_key: str) -> dict:
    return await cerberus.scope(user_key)


@task(name="athena.answer")
async def _answer(user_key: str, question: str, scope: dict, usage: llm.Usage) -> dict:
    return await athena.answer(user_key, question, scope, usage)


@task(name="hephaestus.act")
def _act(user_key: str, question: str, answer: str, plan: dict, usage: llm.Usage, dry_run: bool) -> dict:
    body = hephaestus.draft(question, answer, usage)
    tool = plan.get("action_tool") or "slack_send_message"
    if tool == "slack_send_message":
        tool_input = {"channel": plan.get("target_channel") or "#general", "text": body}
        conn = config.SLACK_CONNECTION
    else:
        tool_input = {"owner": "northwind", "repo": "atlas", "title": body[:80], "body": body}
        conn = config.GITHUB_CONNECTION
    return hephaestus.act(user_key, tool, tool_input, conn, dry_run)


@workflow(name="pantheon.ask")
async def ask(user_key: str, question: str, dry_run: bool = True) -> dict:
    t0 = time.time()
    usage = llm.Usage()
    feed: list[str] = []
    plan = route(question, usage)
    feed.append(f"Hermes routed: {plan['intent']} via {llm.ROUTES['route']}")
    scope = await _scope(user_key)
    feed.append(f"Cerberus: {user_key} may read {scope['readable']}; hidden {list(scope['hidden'])}")
    result = await _answer(user_key, question, scope, usage)
    feed.append(f"Athena: {result['passages']} passages from {result['sources']} via {llm.ROUTES['synthesize']}")
    action = None
    if plan.get("intent") == "action":
        action = _act(user_key, question, result["answer"], plan, usage, dry_run)
        feed.append(f"Hephaestus: {action['tool']} {action['status']} as {config.USERS[user_key]}")
    return {
        "user": user_key,
        "question": question,
        "answer": result["answer"],
        "sources": result["sources"],
        "hidden": result["hidden"],
        "action": action,
        "usage": usage.calls,
        "feed": feed,
        "latency_s": round(time.time() - t0, 2),
    }
