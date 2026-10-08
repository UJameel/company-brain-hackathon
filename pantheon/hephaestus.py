"""Hephaestus (motor cortex): acts in the user's tools, as the user, through Scalekit.

Two ways an action starts:
  1. The user asks for it ("open an issue for Marco"). Hermes routes it here.
  2. Hephaestus proposes it after Athena answers ("want me to post this to #engineering?",
     "ask Alice for access to #leadership?"). Nothing runs until the user decides.

Every proposal has an id and sits in a log until the user approves, declines or revises it.
Approve executes through `execute_tool` with the acting user's identifier, never a shared bot
token. Revise redrafts with the user's note and returns a new proposal. Decisions are
remembered into the user's own dataset, so the brain learns how this person likes to act.
Destructive tools are never exposed; without Scalekit credentials everything is a dry run."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from . import config, llm

ALLOWED_WRITES = {"slack_send_message", "github_issue_create"}
TOOLS = ALLOWED_WRITES | {"request_access"}  # request_access is Cerberus-flavoured: ask the dataset owner
ACTIONS_LOG = config.ROOT / ".pantheon_actions.jsonl"

DRAFT_SYSTEM = """You are Hephaestus, the action agent of a company brain. Given the user's
request and Athena's answer, produce ONLY the body of the message or issue to send, in
plain text, under 60 words, friendly and specific. No preamble."""

PROPOSE_SYSTEM = """You are Hephaestus, the action agent of a company brain called Pantheon. Athena has just
answered a question for a user. Propose at most 2 concrete follow-up actions the user might want,
or none if nothing useful follows. Reply with JSON only: a list of objects
{"tool": "slack_send_message" | "github_issue_create" | "request_access",
 "rationale": "<one sentence, why this helps the user now>",
 "input": {...}}
Tool inputs: slack_send_message -> {"channel": "#name", "text": "<under 60 words>"};
github_issue_create -> {"title": "<short>", "body": "<under 80 words>"};
request_access -> {"owner": "<user key from HIDDEN>", "dataset": "<name>", "text": "<one-line ask>"}.
Only propose request_access when HIDDEN lists something. Never propose anything destructive.
Prefer actions that unblock the team: ask the owner, notify the channel that is waiting, file the follow-up."""

REVISE_SYSTEM = """You are Hephaestus. Rewrite the action payload according to the user's note. Keep the
same tool and the same JSON shape. Reply with the JSON object for "input" only."""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _append(entry: dict) -> None:
    with ACTIONS_LOG.open("a") as f:
        f.write(json.dumps(entry) + "\n")


def _all() -> list[dict]:
    if not ACTIONS_LOG.exists():
        return []
    return [json.loads(l) for l in ACTIONS_LOG.read_text().splitlines() if l.strip()]


def pending(user_key: str | None = None) -> list[dict]:
    latest: dict[str, dict] = {}
    for e in _all():
        latest[e["id"]] = e
    return [e for e in latest.values() if e["status"] == "proposed" and (user_key is None or e["user"] == user_key)]


def get(action_id: str) -> dict | None:
    hits = [e for e in _all() if e["id"] == action_id]
    return hits[-1] if hits else None


def draft(question: str, answer: str, usage: llm.Usage) -> str:
    return llm.complete("draft", DRAFT_SYSTEM, f"Request: {question}\n\nWhat the brain knows: {answer}", usage=usage, max_tokens=200)


def new_proposal(user_key: str, tool: str, tool_input: dict, rationale: str, origin: str, question: str, parent: str | None = None) -> dict:
    entry = {"id": uuid.uuid4().hex[:8], "user": user_key, "as_user": config.USERS[user_key], "tool": tool, "input": tool_input,
             "rationale": rationale, "origin": origin, "question": question, "status": "proposed", "parent": parent, "created_at": _now()}
    _append(entry)
    return entry


def propose(user_key: str, question: str, answer: str, hidden: dict, usage: llm.Usage) -> list[dict]:
    """Suggested follow-ups after an answer. Returned as proposals; nothing is executed."""
    hidden_txt = "\n".join(f"- {name}: owner {meta.get('owner')}, contains {', '.join(meta.get('extra') or meta.get('sources', []))}"
                           for name, meta in (hidden or {}).items()) or "(none)"
    raw = llm.complete("draft", PROPOSE_SYSTEM, f"User: {user_key}\nQuestion: {question}\nAnswer: {answer}\nHIDDEN:\n{hidden_txt}", usage=usage, max_tokens=400)
    try:
        items = json.loads(raw[raw.find("[") : raw.rfind("]") + 1])
    except Exception:
        return []
    out = []
    for it in items[:2]:
        if it.get("tool") in TOOLS and isinstance(it.get("input"), dict) and _target_is_known(it["tool"], it["input"], hidden):
            out.append(new_proposal(user_key, it["tool"], it["input"], it.get("rationale", ""), "suggested", question))
    return out


def _target_is_known(tool: str, inp: dict, hidden: dict) -> bool:
    """Proposals may only point at things the brain already knows: a channel seen in the
    company's own data, a dataset owner that exists, the configured repo. A target that only
    appears inside retrieved text (an address in a forwarded email) is refused. Retrieved
    content can inform an action; it can never choose its destination."""
    if tool == "request_access":
        return inp.get("owner") in config.USERS and inp.get("dataset") in config.load_state().get("datasets", {})
    if tool == "slack_send_message":
        known_channels = {t.split(":", 1)[1] for d in config.load_state().get("datasets", {}).values() for t in d.get("tags", []) if t.startswith("channel:")}
        # Channels the operator explicitly allows for a live demo (the Scalekit connection may be bound to a
        # workspace other than the fictional company's). Comma-separated, no '#'.
        import os
        known_channels |= {c.strip().lstrip("#") for c in os.environ.get("PANTHEON_SLACK_EXTRA_CHANNELS", "").split(",") if c.strip()}
        ch = str(inp.get("channel", "")).lstrip("#")
        return ch in known_channels
    if tool == "github_issue_create":
        return "@" not in json.dumps(inp)  # no addresses smuggled into issues
    return False


def act(user_key: str, tool_name: str, tool_input: dict, connection_name: str, dry_run: bool) -> dict:
    if tool_name not in ALLOWED_WRITES:
        return {"tool": tool_name, "status": "refused", "reason": "not in Hephaestus' allow-list"}
    identifier = config.USERS[user_key]
    if dry_run or not config.scalekit_configured():
        return {"tool": tool_name, "status": "dry-run", "as_user": identifier, "input": tool_input}
    from .mnemosyne import _actions

    actions = _actions()
    try:
        res = actions.execute_tool(tool_name=tool_name, tool_input=tool_input, connection_name=connection_name, identifier=identifier)
    except Exception as e:
        msg = str(e).splitlines()[0]
        if tool_name == "slack_send_message" and "not_in_channel" in msg:
            # Slack requires membership to post; join as the user, then retry once.
            actions.execute_tool(tool_name="slack_join_conversation", tool_input={"channel": tool_input["channel"]}, connection_name=connection_name, identifier=identifier)
            res = actions.execute_tool(tool_name=tool_name, tool_input=tool_input, connection_name=connection_name, identifier=identifier)
        else:
            return {"tool": tool_name, "status": "failed", "as_user": identifier, "input": tool_input, "error": msg[:200]}
    data = res.data if isinstance(res.data, dict) else {}
    link = data.get("html_url") or (f"https://github.com/{tool_input.get('owner')}/{tool_input.get('repo')}/issues/{int(data['number'])}" if tool_name == "github_issue_create" and data.get("number") else None)
    return {"tool": tool_name, "status": "executed", "as_user": identifier, "input": tool_input, "result": str(res.data)[:300], "link": link}


def _execute_proposal(p: dict, dry_run: bool) -> dict:
    tool, inp, user_key = p["tool"], dict(p["input"]), p["user"]
    if tool == "request_access":
        # Ask the owner, as the requesting user, in Slack. Falls back to a dry run without a channel.
        owner = inp.get("owner", "alice")
        text = f"Hi {owner}, {inp.get('text') or 'could you share ' + inp.get('dataset', 'your dataset') + ' with me?'} (sent via Pantheon)"
        return act(user_key, "slack_send_message", {"channel": inp.get("channel") or f"@{owner}", "text": text}, config.SLACK_CONNECTION, dry_run or not inp.get("channel"))
    if tool == "github_issue_create":
        owner, repo = config.GITHUB_REPO.split("/")
        inp = {"owner": owner, "repo": repo, "title": inp.get("title", "Follow-up from Pantheon")[:80],
               "body": (inp.get("body") or "") + "\n\n_Opened by Pantheon (Hephaestus) on behalf of the requesting user via Scalekit._"}
        return act(user_key, tool, inp, config.GITHUB_CONNECTION, dry_run)
    return act(user_key, tool, inp, config.SLACK_CONNECTION, dry_run)


async def decide(action_id: str, decision: str, note: str | None = None, dry_run: bool = True) -> dict:
    """approve | decline | revise. The decision is logged and remembered by the brain."""
    p = get(action_id)
    if not p:
        return {"error": f"no action {action_id}"}
    if p["status"] != "proposed":
        return {"error": f"action {action_id} is already {p['status']}"}
    if decision == "approve":
        result = _execute_proposal(p, dry_run)
        entry = {**p, "status": "executed" if result.get("status") == "executed" else "approved-dry-run", "result": result, "decided_at": _now(), "note": note}
    elif decision == "decline":
        entry = {**p, "status": "declined", "decided_at": _now(), "note": note}
    elif decision == "revise":
        usage = llm.Usage()
        raw = llm.complete("draft", REVISE_SYSTEM, f"Tool: {p['tool']}\nCurrent input: {json.dumps(p['input'])}\nUser note: {note}", usage=usage, max_tokens=300)
        try:
            new_input = json.loads(raw[raw.find("{") : raw.rfind("}") + 1])
        except Exception:
            new_input = p["input"]
        entry = {**p, "status": "revised", "decided_at": _now(), "note": note}
        _append(entry)
        child = new_proposal(p["user"], p["tool"], new_input, p["rationale"], "revised", p["question"], parent=p["id"])
        await _remember_decision(entry)
        return {"decision": "revise", "superseded": p["id"], "proposal": child}
    else:
        return {"error": "decision must be approve, decline or revise"}
    _append(entry)
    await _remember_decision(entry)
    return {"decision": decision, "action": entry}


async def _remember_decision(entry: dict) -> None:
    """The brain learns how this person acts: what they approve, decline, or change.
    Remembering runs Cognee's graph extraction (~10s). In a long-lived process (the API) set
    PANTHEON_ASYNC_MEMORY=1 to do it in the background so the chat reply is immediate."""
    import asyncio
    import os

    if os.environ.get("PANTHEON_ASYNC_MEMORY") == "1":
        asyncio.ensure_future(_remember_decision_now(entry))
        return
    await _remember_decision_now(entry)


async def _remember_decision_now(entry: dict) -> None:
    try:
        import cognee
        from .cerberus import get_or_create_user

        user = await get_or_create_user(entry["user"])
        text = (f"[source:pantheon kind:decision pulled-as:{entry['user']}]\n"
                f"On {entry.get('decided_at')} {entry['user']} {entry['status']} a proposed action: tool {entry['tool']}, "
                f"input {json.dumps(entry['input'])[:300]}. Rationale: {entry.get('rationale', '')}. Note from the user: {entry.get('note') or 'none'}.")
        await cognee.remember(text, dataset_name=config.dataset_for(entry["user"]), user=user,
                              node_set=["source:pantheon", "kind:decision", f"owner:{entry['user']}"])
    except Exception as e:  # never let memory of a decision block the decision itself
        print(f"[morpheus] could not remember decision: {str(e).splitlines()[0][:100]}")
