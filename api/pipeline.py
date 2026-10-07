"""The Pantheon request path, step by step, as an async event stream.

hermes.ask returns everything at the end. The app wants to watch the request move
through the brain, so this module composes the same pantheon functions and yields an
event after each one. The only mirrored code is Athena's prompt assembly (so the
synthesize call can stream tokens); everything else is the package's own functions."""
from __future__ import annotations

import asyncio
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
    return any(g.get("grantee") == user_key for g in config.load_state().get("grants", []))


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
                usage.add("synthesize", model, last)
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

    plan = await asyncio.to_thread(hermes.route, question, usage)
    feed.append(f"Hermes routed: {plan['intent']} via {llm.ROUTES['route']}")
    yield "hermes", {"intent": plan.get("intent"), "action_tool": plan.get("action_tool"), "model": llm.ROUTES["route"]}

    scope = await hermes._scope(user_key)
    feed.append(f"Cerberus: {user_key} may read {scope['readable']}; hidden {list(scope['hidden'])}")
    yield "cerberus", {"readable": scope["readable"], "hidden": scope["hidden"]}

    q = question + ACTION_SUFFIX if plan.get("intent") == "action" else question
    passages = await athena.recall(user_key, q, scope.get("readable_ids") or [])
    sources = athena.sources_in(passages)
    yield "athena.recall", {"passages": len(passages), "sources": sources, "model": llm.ROUTES["synthesize"]}

    prompt = build_prompt(user_key, q, scope, passages)
    answer = ""
    try:
        async for piece in stream_synthesize(prompt, usage):
            answer += piece
            yield "athena.token", {"text": piece}
    except Exception:
        answer = await asyncio.to_thread(llm.complete, "synthesize", athena.SYSTEM, prompt, usage)
        yield "athena.token", {"text": answer}
    answer = answer.strip()
    feed.append(f"Athena: {len(passages)} passages from {sources} via {llm.ROUTES['synthesize']}")

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
    scenario = match(user_key, question, granted_to(user_key), SCENARIOS)
    result["themis"] = None
    if scenario:
        fc = themis.fact_check(scenario, result)
        result["themis"] = {"scenario_id": scenario["id"], **fc}
        yield "themis", result["themis"]
    result["cost_usd"] = cost_usd(usage.calls)
    yield "done", result
