"""The Pantheon request path, step by step, as an async event stream.

hermes.ask returns everything at the end. The app wants to watch the request move
through the brain, so this module composes the same pantheon functions and yields an
event after each one. The only mirrored code is Athena's prompt assembly (so the
synthesize call can stream tokens); everything else is the package's own functions."""
from __future__ import annotations

import asyncio
import json
import re
import time
from typing import AsyncIterator

from pantheon import athena, config, hephaestus, hermes, llm, themis

from .pricing import cost_usd
from .scenarios import load_scenarios, match

ACTION_SUFFIX = ("\n\n(Hephaestus, the action agent, will perform the requested action right after you. "
                 "Do not say you cannot act; give the facts and the person it concerns.)")

try:
    SCENARIOS: list[dict] = load_scenarios()
except Exception:  # scenarios file absent (tests, stripped images)
    SCENARIOS = []


def granted_to(user_key: str) -> bool:
    """Fallback when no scope is at hand: the grants list in the state file."""
    return any(g.get("grantee") == user_key for g in config.load_state().get("grants", []))


def granted_in_scope(user_key: str, scope: dict) -> bool:
    """Cognee is the source of truth: a user is 'granted' when they can read a dataset
    they do not own. The state file can lag behind a grant or revoke."""
    own = config.dataset_for(user_key)
    return any(name != own for name in scope.get("readable") or [])


def build_prompt(user_key: str, question: str, scope: dict, passages: list[str]) -> str:
    """Mirror of pantheon.athena.answer's prompt assembly."""
    hidden = scope.get("hidden") or {}
    shown = [re.sub(r"\s*pulled-as:\S+", "", p) for p in passages]
    context = "\n\n---\n\n".join(shown) if shown else "(no readable passages)"
    hidden_txt = ""
    if hidden:
        hidden_txt = "\n\nHIDDEN (exists, not readable by this user):\n" + "\n".join(
            f"- {name} (owner: {meta.get('owner')}, contains: {', '.join(meta.get('extra') or meta.get('sources', []))})"
            for name, meta in hidden.items()
        )
    return f"User: {user_key} ({scope['identifier']})\nQuestion: {question}\n\nCONTEXT:\n{context}{hidden_txt}"


async def stream_synthesize(prompt: str, usage: llm.Usage) -> AsyncIterator[str]:
    """Stream the synthesize step through the Respan gateway. The blocking OpenAI
    iterator runs in a thread and feeds an asyncio queue."""
    model = llm.ROUTES["synthesize"]
    queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_running_loop()
    DONE = object()

    def produce() -> None:
        try:
            stream = llm.client().chat.completions.create(
                model=model,
                messages=[{"role": "system", "content": athena.SYSTEM}, {"role": "user", "content": prompt}],
                max_completion_tokens=700,
                temperature=0,
                stream=True,
                stream_options={"include_usage": True},
            )
            last = None
            for chunk in stream:
                last = chunk
                if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                    loop.call_soon_threadsafe(queue.put_nowait, chunk.choices[0].delta.content)
            if last is not None and getattr(last, "usage", None):
                usage.add("synthesize", "respan", model, last)  # llm.Usage.add(step, provider, model, resp)
            loop.call_soon_threadsafe(queue.put_nowait, DONE)
        except Exception as e:  # surfaced to the consumer, which falls back
            loop.call_soon_threadsafe(queue.put_nowait, e)

    loop.run_in_executor(None, produce)
    while True:
        item = await queue.get()
        if item is DONE:
            return
        if isinstance(item, Exception):
            raise item
        yield item


async def run(user_key: str, question: str, dry_run: bool = True) -> AsyncIterator[tuple[str, dict]]:
    t0 = time.time()
    usage = llm.Usage()
    feed: list[str] = []

    # hermes.route reads this user's pending proposals through hermes._route_user, exactly as hermes.ask does
    hermes._route_user.append(user_key)
    try:
        plan = await asyncio.to_thread(hermes.route, question, usage)
    finally:
        hermes._route_user.pop()
    route_model = "/".join(llm.model_for("route"))  # provider/model, e.g. ollama/llama3.1:8b or respan/gpt-4o-mini

    if plan.get("intent") == "decision":
        # The user answered a proposal in plain language: apply it, no recall. Mirrors hermes.ask.
        feed.append(f"Hermes routed: decision ({plan['decision']}) on proposal {plan['proposal_id']}")
        yield "hermes", {"intent": "decision", "action_tool": None, "model": route_model, "decision": plan["decision"], "proposal_id": plan["proposal_id"]}
        decided = await hephaestus.decide(plan["proposal_id"], plan["decision"], note=question if plan["decision"] == "revise" else None, dry_run=dry_run)
        yield "hephaestus.decided", {"decision": decided}
        if "error" in decided:
            text = decided["error"]
        elif plan["decision"] == "revise":
            text = f"Revised. New proposal [{decided['proposal']['id']}]: {json.dumps(decided['proposal']['input'])}. Say 'yes' to send it, 'no' to drop it, or tell me what to change."
            yield "hephaestus.proposed", {"proposals": [decided["proposal"]]}
        elif plan["decision"] == "approve":
            a = decided["action"]
            text = ("Done. " if a["status"] == "executed" else "Approved (dry run, nothing sent). ") + f"{a['tool']} as {a['as_user']}: {json.dumps(a['input'])[:300]}"
        else:
            text = "Declined. I'll remember that you didn't want this one."
        feed.append(f"Hephaestus: {plan['decision']} -> {decided.get('action', decided.get('proposal', {})).get('status', 'ok')}")
        yield "done", {
            "user": user_key, "question": question, "answer": text, "sources": [], "hidden": [], "action": decided.get("action"),
            "decision": decided, "suggested_actions": [decided["proposal"]] if plan["decision"] == "revise" and "proposal" in decided else [],
            "usage": usage.calls, "feed": feed, "latency_s": round(time.time() - t0, 2), "themis": None, "cost_usd": cost_usd(usage.calls),
        }
        return

    feed.append(f"Hermes routed: {plan['intent']} via {route_model}")
    yield "hermes", {"intent": plan.get("intent"), "action_tool": plan.get("action_tool"), "model": route_model}

    scope = await hermes._scope(user_key)
    feed.append(f"Cerberus: {user_key} may read {scope['readable']}; hidden {list(scope['hidden'])}")
    yield "cerberus", {"readable": scope["readable"], "hidden": scope["hidden"]}

    q = question + ACTION_SUFFIX if plan.get("intent") == "action" else question
    passages = await athena.recall(user_key, q, scope.get("readable_ids") or [])
    sources = athena.sources_in(passages)
    synth_model = "/".join(llm.model_for("synthesize"))
    yield "athena.recall", {"passages": len(passages), "sources": sources, "model": synth_model}

    prompt = build_prompt(user_key, q, scope, passages)
    answer = ""
    try:
        async for piece in stream_synthesize(prompt, usage):
            answer += piece
            yield "athena.token", {"text": piece}
    except Exception:
        # the stream broke part-way: one plain completion, and the client discards the partial text
        answer = await asyncio.to_thread(llm.complete, "synthesize", athena.SYSTEM, prompt, usage)
        yield "athena.token", {"text": answer, "replace": True}
    answer = answer.strip()
    feed.append(f"Athena: {len(passages)} passages from {sources} via {synth_model}")

    action = None
    if plan.get("intent") == "action":
        action = await asyncio.to_thread(hermes._act, user_key, question, answer, plan, usage, dry_run)
        feed.append(f"Hephaestus: {action['tool']} {action['status']} as {config.USERS[user_key]}")
        yield "hephaestus", action

    # Suggested follow-ups: proposals the user approves, declines or revises. Nothing executes here.
    # Same rule as hermes.ask: only for questions, never after an explicit action request.
    suggested: list[dict] = []
    if plan.get("intent") != "action":
        suggested = await asyncio.to_thread(hermes._propose, user_key, question, answer, scope.get("hidden") or {}, usage)
    if suggested:
        feed.append("Hephaestus proposed: " + "; ".join(f"{s['tool']} [{s['id']}]" for s in suggested))
        yield "hephaestus.proposed", {"proposals": suggested}

    result = {
        "user": user_key, "question": question, "answer": answer, "sources": sources,
        "hidden": list((scope.get("hidden") or {}).keys()), "action": action, "suggested_actions": suggested,
        "usage": usage.calls, "feed": feed, "latency_s": round(time.time() - t0, 2),
    }
    scenario = match(user_key, question, granted_in_scope(user_key, scope), SCENARIOS)
    result["themis"] = None
    if scenario:
        fc = themis.fact_check(scenario, result)
        result["themis"] = {"scenario_id": scenario["id"], **fc}
        yield "themis", result["themis"]
    result["cost_usd"] = cost_usd(usage.calls)
    yield "done", result
