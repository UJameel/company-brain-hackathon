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
{"intent": "question" | "action", "action_tool": null | "slack_send_message" | "github_issue_create",
 "target_channel": null | "#channel-name", "title": null | "<short issue title if opening an issue>"}.
"action" means the user asks to send, post, draft a message, or open/file an issue or ticket."""


@task(name="hermes.route")
def route(question: str, usage: llm.Usage) -> dict:
    from . import decide

    known = sorted({t.split(":", 1)[1] for d in config.load_state().get("datasets", {}).values() for t in d.get("tags", []) if t.startswith("channel:")})
    plan = decide.route(question, known, usage)
    if plan is not None:
        return plan
    raw = llm.complete("route", ROUTE_SYSTEM, question, usage=usage, max_tokens=120, json_mode=True)
    try:
        plan = json.loads(raw[raw.find("{") : raw.rfind("}") + 1])
    except Exception:
        return {"intent": "question", "action_tool": None, "target_channel": None}
    # Normalise: a tool only makes sense for an action; small models sometimes name one anyway.
    if plan.get("intent") != "action":
        plan["intent"] = "question"
        plan["action_tool"] = None
    elif plan.get("action_tool") not in ("slack_send_message", "github_issue_create"):
        plan["action_tool"] = "slack_send_message"
    return plan


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
        owner, repo = config.GITHUB_REPO.split("/")
        title = plan.get("title") or body.split(".")[0][:80]
        tool_input = {"owner": owner, "repo": repo, "title": title, "body": body + "\n\n_Opened by Pantheon (Hephaestus) on behalf of the requesting user via Scalekit._"}
        conn = config.GITHUB_CONNECTION
    result = hephaestus.act(user_key, tool, tool_input, conn, dry_run)
    # Log it as a proposal too, so the UI can approve it later if this was a dry run.
    proposal = hephaestus.new_proposal(user_key, tool, tool_input, "requested by the user", "requested", question)
    if result.get("status") == "executed":
        hephaestus._append({**proposal, "status": "executed", "result": result, "decided_at": hephaestus._now()})
    return {**result, "id": proposal["id"]}


@task(name="hephaestus.propose")
def _propose(user_key: str, question: str, answer: str, hidden: dict, usage: llm.Usage) -> list[dict]:
    return hephaestus.propose(user_key, question, answer, hidden, usage)


@workflow(name="pantheon.ask")
async def ask(user_key: str, question: str, dry_run: bool = True, suggest: bool = True) -> dict:
    t0 = time.time()
    usage = llm.Usage()
    feed: list[str] = []
    plan = route(question, usage)
    feed.append(f"Hermes routed: {plan['intent']} via {'/'.join(llm.model_for('route'))}" + (f" (p={plan['confidence']})" if plan.get("confidence") else ""))
    scope = await _scope(user_key)
    feed.append(f"Cerberus: {user_key} may read {scope['readable']}; hidden {list(scope['hidden'])}")
    q = question
    if plan.get("intent") == "action":
        q = question + "\n\n(Hephaestus, the action agent, will perform the requested action right after you. Do not say you cannot act; give the facts and the person it concerns.)"
    result = await _answer(user_key, q, scope, usage)
    feed.append(f"Athena: {result['passages']} passages from {result['sources']} via {'/'.join(llm.model_for('synthesize'))}")
    action = None
    if plan.get("intent") == "action":
        action = _act(user_key, question, result["answer"], plan, usage, dry_run)
        feed.append(f"Hephaestus: {action['tool']} {action['status']} as {config.USERS[user_key]}")
    suggested: list[dict] = []
    if suggest and plan.get("intent") != "action":
        suggested = _propose(user_key, question, result["answer"], scope.get("hidden") or {}, usage)
        if suggested:
            feed.append("Hephaestus proposed: " + "; ".join(f"{s_['tool']} [{s_['id']}]" for s_ in suggested))
    return {
        "suggested_actions": suggested,
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
