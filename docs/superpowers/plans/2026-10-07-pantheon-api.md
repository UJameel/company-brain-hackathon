# Pantheon API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A FastAPI service in `api/` that streams the Pantheon pipeline step by step over SSE, exposes grant, revoke, execute, scope, evals, scenarios, health and reset, and ships as a Docker image for Fly.io with the ingested Cognee state baked in.

**Architecture:** `api/pipeline.py` composes the existing `pantheon` functions (route, scope, recall, a mirrored synthesize prompt streamed through the Respan gateway, act) and yields `(event, data)` pairs. `api/server.py` turns that into `text/event-stream`, adds per-user locks, a demo-key guard on writes, and the read routes. `api/pricing.py` turns usage rows into an estimated cost. Nothing under `pantheon/` changes.

**Tech Stack:** Python 3.12, FastAPI 0.142, uvicorn 0.54, httpx (tests), pytest, the `openai` client already used by `pantheon.llm`, Docker, Fly.io.

**Spec:** `docs/superpowers/specs/2026-10-07-pantheon-web-design.md` (sections 4, 5, 7, 8)

## Global Constraints

- Nothing inside `pantheon/`, `evals/`, `sample_data/`, `tests/` or `.env` changes.
- One uvicorn worker. Per-user `asyncio.Lock` around chat, ask, sync, notes, insights.
- Writes (`/grant`, `/revoke`, `/action/execute`, `/sync`, `/notes`, `/reset`) require header `X-Demo-Key` equal to env `DEMO_KEY`.
- CORS allow-list: the Vercel domain (env `WEB_ORIGIN`) and `http://localhost:3000`.
- Event order on `/chat`: `hermes`, `cerberus`, `athena.recall`, `athena.token`*, `hephaestus`?, `hephaestus.proposed`?, `themis`?, `done`. `done` carries `suggested_actions` (proposals from `hephaestus.propose`).
- Proposals: `GET /actions?user=` lists `hephaestus.pending(user)`; `POST /actions/{id}/decide` with `{decision: approve|decline|revise, note?, execute?: bool}` calls `hephaestus.decide(id, decision, note, dry_run=not execute)`. Backend commit `b27a51b`.
- Connections come from `mnemosyne.discover(user)` (any Scalekit connector), never a fixed list. Sync passes `all_sources`.
- Cost table: gpt-4o-mini 0.15 in / 0.60 out; claude-sonnet-4-5 3.00 / 15.00; claude-haiku-4-5 1.00 / 5.00 (USD per million tokens).
- Container: `SYSTEM_ROOT_DIRECTORY=/app/state/system`, `DATA_ROOT_DIRECTORY=/app/state/data`, port 8080, non-root uid 1000.
- Run every command from the worktree root `/Users/usmanjameel/company-brain-hackathon/.claude/worktrees/web`. Python is `/Users/usmanjameel/company-brain-hackathon/.venv/bin/python` (the venv is shared with the main checkout; do not create another).
- The worktree has no `.env`. Tests must pass without one. Live local runs need `ln -s /Users/usmanjameel/company-brain-hackathon/.env .env` and must only happen when the backend session is idle, because the state directory in `.env` is the main checkout's.

## Review Focus

1. A question that routes to `action` while Scalekit is not configured: Hephaestus must return `status: "dry-run"` with `as_user`, never raise. Test in Task 3.
2. The synthesize stream failing mid-way (gateway closes): the pipeline must fall back to one non-streamed completion and still emit `done` with an answer. Test in Task 3.
3. `/evals` when `results-before-coverage.json` is missing but `results-after.json` exists: respond with `null` for the missing key, never 500. Test in Task 5.
4. A `/grant` without the demo key, or with a wrong one: 401, state unchanged. Test in Task 5.
5. Two concurrent `/chat` calls for the same user: the second waits for the first (lock), never opens the graph twice. Test in Task 5.

---

### Task 1: Pricing

**Files:**
- Create: `api/__init__.py` (empty)
- Create: `api/pricing.py`
- Test: `api/tests/__init__.py` (empty), `api/tests/test_pricing.py`

**Interfaces:**
- Produces: `cost_usd(calls: list[dict]) -> float` where each call is `{"step", "model", "prompt_tokens", "completion_tokens"}` as produced by `pantheon.llm.Usage.calls`. Unknown model or `None` tokens count as zero. Result rounded to 6 decimals.

- [ ] **Step 1: Write the failing test**

```python
# api/tests/test_pricing.py
from api.pricing import cost_usd


def test_cost_sums_known_models():
    calls = [
        {"step": "route", "model": "gpt-4o-mini", "prompt_tokens": 1_000_000, "completion_tokens": 0},
        {"step": "synthesize", "model": "claude-sonnet-4-5", "prompt_tokens": 0, "completion_tokens": 1_000_000},
    ]
    assert cost_usd(calls) == 15.15


def test_cost_ignores_unknown_model_and_none_tokens():
    calls = [
        {"step": "x", "model": "mystery", "prompt_tokens": 500, "completion_tokens": 500},
        {"step": "route", "model": "gpt-4o-mini", "prompt_tokens": None, "completion_tokens": None},
    ]
    assert cost_usd(calls) == 0.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `/Users/usmanjameel/company-brain-hackathon/.venv/bin/python -m pytest api/tests/test_pricing.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'api'`

- [ ] **Step 3: Write minimal implementation**

```python
# api/pricing.py
"""Estimated USD cost per usage row. Prices are USD per million tokens and are
estimates; the UI labels them as such."""
from __future__ import annotations

PRICES: dict[str, tuple[float, float]] = {
    "gpt-4o-mini": (0.15, 0.60),
    "claude-sonnet-4-5": (3.00, 15.00),
    "claude-haiku-4-5": (1.00, 5.00),
}


def cost_usd(calls: list[dict]) -> float:
    total = 0.0
    for c in calls:
        price = PRICES.get(c.get("model") or "")
        if not price:
            continue
        total += (c.get("prompt_tokens") or 0) * price[0] / 1e6
        total += (c.get("completion_tokens") or 0) * price[1] / 1e6
    return round(total, 6)
```

Create the two empty `__init__.py` files with `touch api/__init__.py api/tests/__init__.py`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `/Users/usmanjameel/company-brain-hackathon/.venv/bin/python -m pytest api/tests/test_pricing.py -v`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add api/__init__.py api/pricing.py api/tests/__init__.py api/tests/test_pricing.py
git commit -m "api: pricing estimate per usage row"
```

---

### Task 2: Scenario matching for live Themis

**Files:**
- Create: `api/scenarios.py`
- Test: `api/tests/test_scenarios.py`

**Interfaces:**
- Produces: `load_scenarios(path=None) -> list[dict]` reading `evals/scenarios.json` by default (path from `pantheon.config.EVALS_DIR`); `match(user: str, question: str, granted: bool, scenarios: list[dict]) -> dict | None` returning the scenario whose `as_user` equals `user` and whose `question` equals the input after `strip()` and `casefold()`; when `granted` is true and the scenario has an `after_grant` dict, the returned dict is `{**scenario, **scenario["after_grant"]}`.
- Consumes: nothing from earlier tasks.

- [ ] **Step 1: Write the failing test**

```python
# api/tests/test_scenarios.py
from api.scenarios import match

SCN = [
    {"id": "pro-price-bob", "as_user": "bob", "question": "What will the Pro plan cost after the Atlas launch?",
     "must_mention": ["$49"], "must_not_mention": ["$59"],
     "after_grant": {"must_mention": ["$59"], "must_not_mention": []}},
    {"id": "pro-price-alice", "as_user": "alice", "question": "What will the Pro plan cost after the Atlas launch?",
     "must_mention": ["$59"]},
]


def test_match_is_case_and_whitespace_insensitive_and_per_user():
    s = match("bob", "  what will the pro plan cost after the atlas launch?  ", False, SCN)
    assert s["id"] == "pro-price-bob"
    assert s["must_mention"] == ["$49"]


def test_match_applies_after_grant_expectations():
    s = match("bob", "What will the Pro plan cost after the Atlas launch?", True, SCN)
    assert s["must_mention"] == ["$59"] and s["must_not_mention"] == []


def test_match_returns_none_for_unknown_question():
    assert match("bob", "Who is on call?", False, SCN) is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `/Users/usmanjameel/company-brain-hackathon/.venv/bin/python -m pytest api/tests/test_scenarios.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'api.scenarios'`

- [ ] **Step 3: Write minimal implementation**

```python
# api/scenarios.py
"""Find the eval scenario a live question corresponds to, so Themis can score live traffic."""
from __future__ import annotations

import json
from pathlib import Path


def load_scenarios(path: Path | None = None) -> list[dict]:
    if path is None:
        from pantheon import config

        path = config.EVALS_DIR / "scenarios.json"
    return json.loads(Path(path).read_text())


def _norm(q: str) -> str:
    return " ".join(q.split()).casefold()


def match(user: str, question: str, granted: bool, scenarios: list[dict]) -> dict | None:
    q = _norm(question)
    for s in scenarios:
        if s.get("as_user") == user and _norm(s.get("question", "")) == q:
            if granted and isinstance(s.get("after_grant"), dict):
                return {**s, **s["after_grant"]}
            return s
    return None
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `/Users/usmanjameel/company-brain-hackathon/.venv/bin/python -m pytest api/tests/test_scenarios.py -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add api/scenarios.py api/tests/test_scenarios.py
git commit -m "api: match live questions to eval scenarios"
```

---

### Task 3: Streaming pipeline

**Files:**
- Create: `api/pipeline.py`
- Test: `api/tests/test_pipeline.py`

**Interfaces:**
- Consumes: `pantheon.hermes.route(question, usage) -> dict`, `pantheon.hermes._scope(user_key) -> dict` (async, task-traced), `pantheon.hermes._propose(user_key, question, answer, hidden, usage) -> list[dict]` (task-traced wrapper over `hephaestus.propose`), `pantheon.athena.recall(user_key, question, readable_ids) -> list[str]` (async), `pantheon.athena.sources_in(passages) -> list[str]`, `pantheon.athena.SYSTEM`, `pantheon.hermes._act(user_key, question, answer, plan, usage, dry_run) -> dict`, `pantheon.llm.client()`, `pantheon.llm.ROUTES`, `pantheon.llm.Usage`, `pantheon.themis.fact_check(scenario, result) -> dict`, `pantheon.config.USERS`, `pantheon.config.load_state()`, `api.pricing.cost_usd`, `api.scenarios.load_scenarios`, `api.scenarios.match`.
- Produces: `async def run(user_key: str, question: str, dry_run: bool = True) -> AsyncIterator[tuple[str, dict]]` yielding events in the order `hermes`, `cerberus`, `athena.recall`, `athena.token` (zero or more), `hephaestus` (only for action intent), `themis` (only when a scenario matches), `done`. The `done` payload has keys `user, question, answer, sources, hidden, action, usage, feed, latency_s, themis, cost_usd`. Also `build_prompt(user_key, question, scope, passages) -> str` and `stream_synthesize(prompt, usage) -> AsyncIterator[str]`, both module level so tests can patch them, and `granted_to(user_key) -> bool`.

- [ ] **Step 1: Write the failing test**

```python
# api/tests/test_pipeline.py
import asyncio

import pytest

from api import pipeline


async def collect(user="bob", question="What will the Pro plan cost after the Atlas launch?", dry_run=True):
    events = []
    async for name, data in pipeline.run(user, question, dry_run):
        events.append((name, data))
    return events


@pytest.fixture
def fake_backend(monkeypatch):
    """Stub every pantheon call the pipeline makes. Records the usage rows the way llm.Usage does."""
    def route(question, usage):
        usage.calls.append({"step": "route", "model": "gpt-4o-mini", "prompt_tokens": 100, "completion_tokens": 10})
        return {"intent": "action" if "draft" in question.lower() else "question", "action_tool": "slack_send_message", "target_channel": "#general"}

    async def scope(user_key):
        return {"user": user_key, "identifier": f"{user_key}@northwind.dev", "readable": [f"{user_key}-brain"],
                "readable_ids": ["00000000-0000-0000-0000-000000000001"],
                "hidden": {"alice-brain": {"owner": "alice", "extra": ["channel:leadership"]}} if user_key == "bob" else {}}

    async def recall(user_key, question, readable_ids):
        return ["[source:slack channel:#general pulled-as:bob] Pro is $49."]

    async def stream(prompt, usage):
        for piece in ["The Pro plan ", "costs $49 ", "(Slack #general)."]:
            yield piece
        usage.calls.append({"step": "synthesize", "model": "claude-sonnet-4-5", "prompt_tokens": 800, "completion_tokens": 40})

    def act(user_key, question, answer, plan, usage, dry_run):
        usage.calls.append({"step": "draft", "model": "claude-haiku-4-5", "prompt_tokens": 50, "completion_tokens": 20})
        return {"tool": plan["action_tool"], "status": "dry-run", "as_user": f"{user_key}@northwind.dev", "input": {"channel": "#general", "text": "hi"}}

    monkeypatch.setattr(pipeline.hermes, "route", route)
    monkeypatch.setattr(pipeline.hermes, "_scope", scope)
    monkeypatch.setattr(pipeline.athena, "recall", recall)
    monkeypatch.setattr(pipeline, "stream_synthesize", stream)
    monkeypatch.setattr(pipeline.hermes, "_act", act)

    def propose(user_key, question, answer, hidden, usage):
        return [{"id": "a1", "user": user_key, "as_user": f"{user_key}@northwind.dev", "tool": "request_access", "input": {"owner": "alice", "dataset": "alice-brain"},
                 "rationale": "alice-brain holds the leadership channel", "origin": "suggested", "status": "proposed", "parent": None, "created_at": "2026-10-07T23:00:00Z"}] if hidden else []

    monkeypatch.setattr(pipeline.hephaestus, "propose", propose)
    monkeypatch.setattr(pipeline, "granted_to", lambda user_key: False)
    monkeypatch.setattr(pipeline, "SCENARIOS", [
        {"id": "pro-price-bob", "as_user": "bob", "question": "What will the Pro plan cost after the Atlas launch?",
         "must_mention": ["$49"], "must_not_mention": ["$59"], "expected_sources": ["source:slack"]},
    ])


def test_event_order_and_done_payload(fake_backend):
    events = asyncio.run(collect())
    names = [n for n, _ in events]
    assert names[:3] == ["hermes", "cerberus", "athena.recall"]
    assert names.count("athena.token") == 3
    assert names[-3:] == ["hephaestus.proposed", "themis", "done"]
    assert "hephaestus" not in names
    done = events[-1][1]
    assert done["suggested_actions"][0]["tool"] == "request_access"
    assert done["feed"][-1].startswith("Hephaestus proposed: request_access [a1]")
    assert done["answer"] == "The Pro plan costs $49 (Slack #general)."
    assert done["sources"] == ["source:slack"]
    assert done["hidden"] == ["alice-brain"]
    assert done["action"] is None
    assert [u["step"] for u in done["usage"]] == ["route", "synthesize"]
    assert done["cost_usd"] == round(100 * 0.15 / 1e6 + 10 * 0.60 / 1e6 + 800 * 3 / 1e6 + 40 * 15 / 1e6, 6)
    assert done["themis"]["fact_score"] == 1.0 and done["themis"]["scenario_id"] == "pro-price-bob"
    assert len(done["feed"]) == 4 and done["feed"][0].startswith("Hermes routed: question")


def test_action_intent_emits_hephaestus(fake_backend):
    events = asyncio.run(collect(user="alice", question="Draft a Slack message to Priya about the blog post."))
    names = [n for n, _ in events]
    assert "hephaestus" in names and names.index("hephaestus") > names.index("athena.recall")
    done = events[-1][1]
    assert done["action"]["status"] == "dry-run" and done["action"]["as_user"] == "alice@northwind.dev"
    assert done["themis"] is None
    assert done["suggested_actions"] == []  # alice has nothing hidden, the stub proposes nothing
    assert done["feed"][-1].startswith("Hephaestus: slack_send_message dry-run as alice@northwind.dev")


def test_stream_failure_falls_back_to_single_completion(fake_backend, monkeypatch):
    async def broken(prompt, usage):
        yield "The Pro "
        raise RuntimeError("gateway closed")

    monkeypatch.setattr(pipeline, "stream_synthesize", broken)
    monkeypatch.setattr(pipeline.llm, "complete", lambda step, system, user, usage=None, max_tokens=700: "The Pro plan costs $49.")
    events = asyncio.run(collect())
    done = events[-1][1]
    assert done["answer"] == "The Pro plan costs $49."
    assert events[-1][0] == "done"


def test_build_prompt_mirrors_athena():
    scope = {"identifier": "bob@northwind.dev", "hidden": {"alice-brain": {"owner": "alice", "extra": ["channel:leadership"]}}}
    p = pipeline.build_prompt("bob", "Q?", scope, ["[source:slack pulled-as:bob] hello"])
    assert "User: bob (bob@northwind.dev)" in p
    assert "pulled-as" not in p
    assert "HIDDEN (exists, not readable by this user):" in p and "alice-brain (owner: alice, contains: channel:leadership)" in p
```

- [ ] **Step 2: Run test to verify it fails**

Run: `/Users/usmanjameel/company-brain-hackathon/.venv/bin/python -m pytest api/tests/test_pipeline.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'api.pipeline'`

- [ ] **Step 3: Write the implementation**

```python
# api/pipeline.py
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

    asyncio.get_running_loop().run_in_executor(None, produce)
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `/Users/usmanjameel/company-brain-hackathon/.venv/bin/python -m pytest api/tests/test_pipeline.py -v`
Expected: 4 passed. Importing `pantheon.hermes` pulls in cognee and logs its startup banner; that is expected noise.

- [ ] **Step 5: Commit**

```bash
git add api/pipeline.py api/tests/test_pipeline.py
git commit -m "api: step-by-step pipeline with streamed synthesis"
```

---

### Task 4: Evals and state readers

**Files:**
- Create: `api/readers.py`
- Test: `api/tests/test_readers.py`

**Interfaces:**
- Produces: `read_results(label: str) -> dict | None` reading `EVALS_DIR / f"results-{label}.json"`; `evals_payload() -> dict` with keys `before` (label `before-coverage`), `after` (label `after`), `isolation` (label `before`), each the parsed file or `None`, plus `change: "grant alice to bob (read on alice-brain)"`; `grants() -> list[dict]` from `config.load_state()`.

- [ ] **Step 1: Write the failing test**

```python
# api/tests/test_readers.py
import json

from api import readers


def test_evals_payload_tolerates_missing_files(tmp_path, monkeypatch):
    (tmp_path / "results-after.json").write_text(json.dumps({"label": "after", "n": 1, "mean": 1.0, "rows": []}))
    monkeypatch.setattr(readers.config, "EVALS_DIR", tmp_path)
    p = readers.evals_payload()
    assert p["after"]["mean"] == 1.0
    assert p["before"] is None and p["isolation"] is None
    assert p["change"].startswith("grant alice to bob")


def test_grants_reads_state(tmp_path, monkeypatch):
    monkeypatch.setattr(readers.config, "load_state", lambda: {"datasets": {}, "grants": [{"owner": "alice", "grantee": "bob", "dataset": "alice-brain", "permission": "read"}]})
    assert readers.grants()[0]["grantee"] == "bob"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `/Users/usmanjameel/company-brain-hackathon/.venv/bin/python -m pytest api/tests/test_readers.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'api.readers'`

- [ ] **Step 3: Write minimal implementation**

```python
# api/readers.py
"""Read-only views over the eval results and the grant state file."""
from __future__ import annotations

import json

from pantheon import config

CHANGE = "grant alice to bob (read on alice-brain)"


def read_results(label: str) -> dict | None:
    path = config.EVALS_DIR / f"results-{label}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text())


def evals_payload() -> dict:
    return {
        "before": read_results("before-coverage"),
        "after": read_results("after"),
        "isolation": read_results("before"),
        "change": CHANGE,
    }


def grants() -> list[dict]:
    return list(config.load_state().get("grants", []))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `/Users/usmanjameel/company-brain-hackathon/.venv/bin/python -m pytest api/tests/test_readers.py -v`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add api/readers.py api/tests/test_readers.py
git commit -m "api: evals and grants readers"
```

---

### Task 5: FastAPI server

**Files:**
- Create: `api/server.py`
- Create: `api/requirements.txt`
- Test: `api/tests/test_server.py`

**Interfaces:**
- Consumes: `api.pipeline.run`, `api.pipeline.granted_to`, `api.readers.evals_payload`, `api.readers.grants`, `api.scenarios.SCENARIOS` via `api.pipeline.SCENARIOS`, `pantheon.hermes.ask`, `pantheon.cerberus.grant/revoke/scope`, `pantheon.hephaestus.act`, `pantheon.config`.
- Produces: FastAPI `app` with routes `POST /chat` (SSE), `POST /ask`, `POST /grant`, `POST /revoke`, `POST /action/execute`, `GET /scope`, `GET /evals`, `GET /scenarios`, `GET /health`, `POST /reset`. SSE frames are `event: <name>\ndata: <json>\n\n`. Request models: `AskBody(user: str, question: str, dry_run: bool = True)`, `GrantBody(owner: str, to: str)`, `ExecuteBody(user: str, tool: str, input: dict)`.

- [ ] **Step 1: Write the failing test**

```python
# api/tests/test_server.py
import json
import threading
import time

import pytest
from fastapi.testclient import TestClient

from api import server


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("DEMO_KEY", "k")
    server.DEMO_KEY = "k"

    async def fake_run(user, question, dry_run=True):
        yield "hermes", {"intent": "question"}
        yield "done", {"user": user, "question": question, "answer": "42", "sources": [], "hidden": [], "action": None,
                       "usage": [], "feed": [], "latency_s": 0.1, "themis": None, "cost_usd": 0.0}

    monkeypatch.setattr(server.pipeline, "run", fake_run)
    monkeypatch.setattr(server.readers, "evals_payload", lambda: {"before": None, "after": {"mean": 1.0}, "isolation": None, "change": "grant alice to bob"})
    monkeypatch.setattr(server.readers, "grants", lambda: [])
    return TestClient(server.app)


def parse_sse(text: str) -> list[tuple[str, dict]]:
    out = []
    for frame in text.strip().split("\n\n"):
        lines = dict(l.split(": ", 1) for l in frame.splitlines())
        out.append((lines["event"], json.loads(lines["data"])))
    return out


def test_chat_streams_events(client):
    r = client.post("/chat", json={"user": "bob", "question": "Q?"})
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/event-stream")
    events = parse_sse(r.text)
    assert [e for e, _ in events] == ["hermes", "done"]
    assert events[-1][1]["answer"] == "42"


def test_chat_rejects_unknown_user(client):
    assert client.post("/chat", json={"user": "mallory", "question": "Q?"}).status_code == 422


def test_evals_tolerates_missing(client):
    r = client.get("/evals")
    assert r.status_code == 200 and r.json()["before"] is None and r.json()["after"]["mean"] == 1.0


def test_grant_requires_demo_key(client, monkeypatch):
    called = []

    async def fake_grant(owner, to):
        called.append((owner, to))
        return "alice granted read on alice-brain to bob"

    monkeypatch.setattr(server.cerberus, "grant", fake_grant)
    assert client.post("/grant", json={"owner": "alice", "to": "bob"}).status_code == 401
    assert client.post("/grant", json={"owner": "alice", "to": "bob"}, headers={"X-Demo-Key": "wrong"}).status_code == 401
    assert called == []
    r = client.post("/grant", json={"owner": "alice", "to": "bob"}, headers={"X-Demo-Key": "k"})
    assert r.status_code == 200 and r.json()["message"].startswith("alice granted") and called == [("alice", "bob")]


def test_health_reports_mode(client):
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["ok"] is True and r.json()["users"] == ["alice", "bob"]


def test_actions_list_and_decide(client, monkeypatch):
    pend = [{"id": "a1", "user": "bob", "tool": "request_access", "input": {}, "status": "proposed"}]
    monkeypatch.setattr(server.hephaestus, "pending", lambda user_key=None: [p for p in pend if user_key in (None, p["user"])])
    seen = {}

    async def decide(action_id, decision, note=None, dry_run=True):
        seen.update(id=action_id, decision=decision, note=note, dry_run=dry_run)
        return {"decision": decision, "action": {**pend[0], "status": "approved-dry-run"}}

    monkeypatch.setattr(server.hephaestus, "decide", decide)
    assert client.get("/actions?user=bob").json() == pend
    assert client.get("/actions?user=alice").json() == []
    assert client.post("/actions/a1/decide", json={"decision": "approve"}).status_code == 401
    r = client.post("/actions/a1/decide", json={"decision": "approve", "execute": False}, headers={"X-Demo-Key": "k"})
    assert r.status_code == 200 and r.json()["action"]["status"] == "approved-dry-run"
    assert seen == {"id": "a1", "decision": "approve", "note": None, "dry_run": True}


def test_same_user_chats_are_serialised(client, monkeypatch):
    """Driven at the handler level with asyncio.gather; TestClient cannot interleave two
    blocking calls that share an asyncio.Lock (it deadlocks)."""
    import asyncio

    order = []

    async def slow_run(user, question, dry_run=True):
        order.append(f"start:{question}")
        await asyncio.sleep(0.1)
        order.append(f"end:{question}")
        yield "done", {"answer": question}

    monkeypatch.setattr(server.pipeline, "run", slow_run)

    async def drain(q):
        resp = await server.chat(server.AskBody(user="bob", question=q))
        return [chunk async for chunk in resp.body_iterator]

    async def main():
        a = asyncio.create_task(drain("one"))
        await asyncio.sleep(0.02)
        b = asyncio.create_task(drain("two"))
        return await asyncio.gather(a, b)

    out = asyncio.run(main())
    assert all(any("event: done" in c for c in chunks) for chunks in out)
    assert order == ["start:one", "end:one", "start:two", "end:two"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `/Users/usmanjameel/company-brain-hackathon/.venv/bin/python -m pytest api/tests/test_server.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'api.server'`

- [ ] **Step 3: Write the implementation**

```python
# api/server.py
"""Pantheon HTTP API: the web app's window onto the brain."""
from __future__ import annotations

import asyncio
import json
import os
import shutil
from collections import defaultdict
from pathlib import Path
from typing import AsyncIterator, Literal

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from pantheon import cerberus, config, hephaestus, hermes

from . import pipeline, readers

DEMO_KEY = os.environ.get("DEMO_KEY", "")
WEB_ORIGIN = os.environ.get("WEB_ORIGIN", "")
PRISTINE = Path(os.environ.get("PRISTINE_STATE_DIR", ""))
LIVE = Path(os.environ.get("LIVE_STATE_DIR", ""))

app = FastAPI(title="Pantheon API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in [WEB_ORIGIN, "http://localhost:3000"] if o],
    allow_methods=["*"], allow_headers=["*"],
)

_locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)
User = Literal["alice", "bob"]


class AskBody(BaseModel):
    user: User
    question: str
    dry_run: bool = True


class GrantBody(BaseModel):
    owner: User
    to: User


class ExecuteBody(BaseModel):
    user: User
    tool: str
    input: dict


class DecideBody(BaseModel):
    decision: Literal["approve", "decline", "revise"]
    note: str | None = None
    execute: bool = False


def demo_key(x_demo_key: str = Header(default="")) -> None:
    if not DEMO_KEY or x_demo_key != DEMO_KEY:
        raise HTTPException(401, "missing or wrong X-Demo-Key")


def _sse(name: str, data: dict) -> str:
    return f"event: {name}\ndata: {json.dumps(data)}\n\n"


@app.post("/chat")
async def chat(body: AskBody) -> StreamingResponse:
    async def gen() -> AsyncIterator[str]:
        async with _locks[body.user]:
            try:
                async for name, data in pipeline.run(body.user, body.question, body.dry_run):
                    yield _sse(name, data)
            except Exception as e:  # the stream has already started; report inline
                yield _sse("error", {"detail": str(e)[:300]})

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.post("/ask")
async def ask(body: AskBody) -> dict:
    async with _locks[body.user]:
        result = await hermes.ask(body.user, body.question, dry_run=body.dry_run)
    scenario = pipeline.match(body.user, body.question, pipeline.granted_to(body.user), pipeline.SCENARIOS)
    result["themis"] = {"scenario_id": scenario["id"], **pipeline.themis.fact_check(scenario, result)} if scenario else None
    result["cost_usd"] = pipeline.cost_usd(result["usage"])
    return result


@app.post("/grant", dependencies=[Depends(demo_key)])
async def grant(body: GrantBody) -> dict:
    return {"message": await cerberus.grant(body.owner, body.to), "grants": readers.grants()}


@app.post("/revoke", dependencies=[Depends(demo_key)])
async def revoke(body: GrantBody) -> dict:
    return {"message": await cerberus.revoke(body.owner, body.to), "grants": readers.grants()}


@app.post("/action/execute", dependencies=[Depends(demo_key)])
async def execute(body: ExecuteBody) -> dict:
    conn = config.SLACK_CONNECTION if body.tool == "slack_send_message" else config.GITHUB_CONNECTION
    return await asyncio.to_thread(hephaestus.act, body.user, body.tool, body.input, conn, False)


@app.get("/scope")
async def scope(user: User) -> dict:
    return await cerberus.scope(user)


@app.get("/actions")
def actions(user: User | None = None, history: bool = False) -> list[dict]:
    """Pending proposals by default; with history=true, the latest state of every proposal
    (approved, declined, revised too) so the UI can show what the person decided."""
    if not history:
        return hephaestus.pending(user)
    latest: dict[str, dict] = {}
    for e in hephaestus._all():
        latest[e["id"]] = e
    return [e for e in latest.values() if user is None or e["user"] == user]


@app.post("/actions/{action_id}/decide", dependencies=[Depends(demo_key)])
async def decide(action_id: str, body: DecideBody) -> dict:
    user = (hephaestus.get(action_id) or {}).get("user", "alice")
    async with _locks[user]:  # approve may write to Scalekit and the decision is remembered into Cognee
        out = await hephaestus.decide(action_id, body.decision, body.note, dry_run=not body.execute)
    if "error" in out:
        raise HTTPException(404 if out["error"].startswith("no action") else 409, out["error"])
    return out


@app.get("/evals")
def evals() -> dict:
    return readers.evals_payload()


@app.get("/scenarios")
def scenarios() -> list[dict]:
    return pipeline.SCENARIOS


@app.get("/health")
def health() -> dict:
    return {"ok": True, "mode": "live", "users": list(config.USERS), "grants": readers.grants()}


@app.post("/reset", dependencies=[Depends(demo_key)])
async def reset() -> dict:
    if not (PRISTINE.is_dir() and str(LIVE)):
        raise HTTPException(400, "reset needs PRISTINE_STATE_DIR and LIVE_STATE_DIR")
    shutil.rmtree(LIVE, ignore_errors=True)
    shutil.copytree(PRISTINE, LIVE)
    asyncio.get_running_loop().call_later(0.3, os._exit, 0)  # Fly restarts the machine
    return {"ok": True, "restarting": True}


@app.on_event("startup")
def restore_state_if_empty() -> None:
    if PRISTINE.is_dir() and str(LIVE) and not any(LIVE.glob("*")):
        shutil.copytree(PRISTINE, LIVE, dirs_exist_ok=True)
```

```text
# api/requirements.txt  (pinned to what the venv has today)
cognee==1.6.3
scalekit-sdk-python==2.20.0
openai==2.54.0
python-dotenv==1.2.4
respan-ai==4.2.3
fastapi==0.142.4
uvicorn==0.54.0
httpx==0.28.1
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `/Users/usmanjameel/company-brain-hackathon/.venv/bin/python -m pytest api/tests -v`
Expected: 18 passed across the five files

- [ ] **Step 5: Smoke the live server once, only if the backend session is idle**

Ask Usman before this step. Then:

```bash
ln -sf /Users/usmanjameel/company-brain-hackathon/.env .env
DEMO_KEY=dev /Users/usmanjameel/company-brain-hackathon/.venv/bin/python -m uvicorn api.server:app --port 8080 &
sleep 8
curl -sN -X POST localhost:8080/chat -H 'content-type: application/json' -d '{"user":"bob","question":"What will the Pro plan cost after the Atlas launch?"}' | head -40
kill %1
```

Expected: `event: hermes`, `event: cerberus`, `event: athena.recall`, several `event: athena.token`, `event: themis`, `event: done`. If `athena.token` arrives as one big frame, the gateway does not stream and the fallback fired; note it in the PR.

- [ ] **Step 6: Commit**

```bash
git add api/server.py api/requirements.txt api/tests/test_server.py
git commit -m "api: FastAPI server with SSE chat, grant, revoke, execute, evals, reset"
```

---

### Task 6: Docker image and Fly config

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `fly.toml`, `api/build_image.sh`

**Interfaces:**
- Consumes: `api/requirements.txt`, the ingested state directories from the main checkout (`STATE_SRC`, default `/Users/usmanjameel/company-brain-hackathon`).
- Produces: image `pantheon-api` listening on 8080 with the state at `/app/state-pristine` and `/app/state`.

- [ ] **Step 1: Write the build script that refuses an un-checkpointed graph**

```bash
# api/build_image.sh
#!/usr/bin/env bash
# Copies the ingested Cognee state into the build context and builds the image.
# Refuses to run while Ladybug has a non-empty write-ahead log: that means a pantheon
# process is still open on the graph and the copy would be unsafe.
set -euo pipefail
STATE_SRC="${STATE_SRC:-/Users/usmanjameel/company-brain-hackathon}"
cd "$(dirname "$0")/.."
if find "$STATE_SRC/.cognee_system" -name '*.wal' -size +0c | grep -q .; then
  echo "refusing: non-empty .lbug.wal under $STATE_SRC/.cognee_system; stop every pantheon process first" >&2
  exit 1
fi
rm -rf build-state && mkdir -p build-state
cp -R "$STATE_SRC/.cognee_system" build-state/system
cp -R "$STATE_SRC/.data_storage" build-state/data
cp "$STATE_SRC/.pantheon_state.json" build-state/pantheon_state.json
docker build --platform linux/amd64 -t pantheon-api .
```

Run: `chmod +x api/build_image.sh`

- [ ] **Step 2: Write the Dockerfile, .dockerignore and fly.toml**

```dockerfile
# Dockerfile
# Adapted from cognee's official image: uv on Python 3.12, the Ladybug JSON extension
# baked in (its runtime install fails for a non-root user), non-root uid 1000.
FROM ghcr.io/ladybugdb/extension-repo AS ladybug-extensions

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim
ENV PYTHONUNBUFFERED=1 UV_SYSTEM_PYTHON=1 HOME=/app \
    HF_HUB_OFFLINE=1 TOKENIZERS_PARALLELISM=false ENABLE_BACKEND_ACCESS_CONTROL=true \
    SYSTEM_ROOT_DIRECTORY=/app/state/system DATA_ROOT_DIRECTORY=/app/state/data \
    PRISTINE_STATE_DIR=/app/state-pristine LIVE_STATE_DIR=/app/state PORT=8080
RUN apt-get update && apt-get install -y --no-install-recommends curl libpq5 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY api/requirements.txt api/requirements.txt
RUN uv pip install -r api/requirements.txt
COPY --from=ladybug-extensions / /app/cognee_db_workers/ladybug_extensions/
COPY pantheon pantheon
COPY api api
COPY evals evals
COPY sample_data sample_data
COPY build-state /app/state-pristine
RUN useradd -u 1000 -m -d /app -s /bin/bash cognee 2>/dev/null || true \
 && mkdir -p /app/state && chown -R 1000:1000 /app
USER 1000
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD curl -f http://localhost:8080/health || exit 1
CMD ["uvicorn", "api.server:app", "--host", "0.0.0.0", "--port", "8080"]
```

Before the first build, confirm the extension path by reading cognee's Dockerfile at `https://raw.githubusercontent.com/topoteretes/cognee/main/Dockerfile` and copy its exact `COPY --from` line for the ladybug extensions if it differs from the one above.

```text
# .dockerignore
.venv
.git
.claude
.cognee_system
.data_storage
web
docs
tests
cognee-feedback.md
.env
.playwright-mcp
```

```toml
# fly.toml
app = "pantheon-api"
primary_region = "sjc"

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "8080"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

  [[http_service.checks]]
    interval = "30s"
    timeout = "5s"
    grace_period = "20s"
    method = "GET"
    path = "/health"

[[vm]]
  size = "shared-cpu-1x"
  memory = "1gb"
```

The `.pantheon_state.json` the API reads lives at `config.STATE_FILE = ROOT / ".pantheon_state.json"` where `ROOT` is the repo root inside the image (`/app`). Add this line to the Dockerfile after the state copy so the grants file is in place: `RUN cp /app/state-pristine/pantheon_state.json /app/.pantheon_state.json` and make `/app` writable by uid 1000 (already done by the `chown`).

- [ ] **Step 3: Build locally and smoke it**

Only after the backend session has exited cleanly (no non-empty `.wal`). Run:

```bash
api/build_image.sh
docker run --rm -p 8080:8080 --env-file /Users/usmanjameel/company-brain-hackathon/.env \
  -e SYSTEM_ROOT_DIRECTORY=/app/state/system -e DATA_ROOT_DIRECTORY=/app/state/data -e DEMO_KEY=dev pantheon-api &
sleep 15
curl -s localhost:8080/health
curl -s localhost:8080/scope?user=bob
curl -sN -X POST localhost:8080/chat -H 'content-type: application/json' -d '{"user":"bob","question":"What will the Pro plan cost after the Atlas launch?"}' | head -20
docker stop $(docker ps -q --filter ancestor=pantheon-api)
```

Expected: health `ok`, scope lists `bob-brain` readable and `alice-brain` hidden, chat streams. The `--env-file` passes the Respan and Scalekit keys; the two `-e` flags override the laptop paths from `.env`.

- [ ] **Step 4: Deploy to Fly (needs `fly auth login` done by Usman)**

```bash
fly launch --no-deploy --copy-config --name pantheon-api --region sjc
grep -vE '^(SYSTEM_ROOT_DIRECTORY|DATA_ROOT_DIRECTORY|#|$)' /Users/usmanjameel/company-brain-hackathon/.env | fly secrets import
fly secrets set DEMO_KEY="$(openssl rand -hex 12)" WEB_ORIGIN="https://<vercel-domain>"
fly deploy --local-only
fly status
curl -s https://pantheon-api.fly.dev/health
```

Expected: one machine running, health `ok`. Record the `DEMO_KEY` value for the Vercel env.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile .dockerignore fly.toml api/build_image.sh
git commit -m "deploy: Docker image with baked Cognee state and Fly config"
```

---

### Task 7: Graph and connections routes (tier 2)

**Files:**
- Create: `api/graph.py`, `api/connections.py`
- Modify: `api/server.py` (add routes)
- Test: `api/tests/test_graph.py`, `api/tests/test_connections.py`

**Interfaces:**
- Produces: `graph_for(user_key: str, max_nodes: int = 600) -> dict` with `{"nodes": [{"id", "label", "type", "node_set": [...], "dataset"}], "edges": [{"source", "target", "label"}]}`; `connections_for(user_key: str) -> list[dict]` built from `mnemosyne.discover(user_key)` (rows `{connection, provider, status, adapter}`) with an added `link` (the Scalekit authorization URL when status is not `ACTIVE`). Bob may legitimately have zero rows. Routes `GET /graph?user=&max_nodes=` and `GET /connections?user=`, and `POST /sync` (demo key) with body `{user, channels: list[str], github_repo: str | None, notion_query: str | None, all_sources: bool = true}` running `mnemosyne.ingest(user, True, channels, github_repo, notion_query, all_sources=all_sources)` under the user's lock and returning its dict (includes a `systems` manifest).

- [ ] **Step 1: Write the failing tests**

```python
# api/tests/test_graph.py
import asyncio

from api import graph


def test_graph_shapes_cognee_payload(monkeypatch):
    async def fake_fetch(user_key, max_nodes):
        return {"nodes": [{"id": "n1", "label": "Atlas", "type": "Entity", "properties": {"node_set": ["source:slack"], "dataset": "alice-brain"}},
                          {"id": "n2", "label": "Priya", "type": "Entity", "properties": {}}],
                "edges": [{"source_node_id": "n1", "target_node_id": "n2", "relationship_name": "owned_by"}]}

    monkeypatch.setattr(graph, "fetch_raw", fake_fetch)
    g = asyncio.run(graph.graph_for("alice", 10))
    assert g["nodes"][0] == {"id": "n1", "label": "Atlas", "type": "Entity", "node_set": ["source:slack"], "dataset": "alice-brain"}
    assert g["nodes"][1]["node_set"] == [] and g["edges"][0] == {"source": "n1", "target": "n2", "label": "owned_by"}
```

```python
# api/tests/test_connections.py
from types import SimpleNamespace

from api import connections


def test_connections_add_links_to_discovered_systems(monkeypatch):
    class Actions:
        def get_authorization_link(self, connection_name, identifier):
            return SimpleNamespace(link=f"https://auth.example/{connection_name}")

    monkeypatch.setattr(connections, "_actions", lambda: Actions())
    monkeypatch.setattr(connections.mnemosyne, "discover", lambda user_key: [
        {"connection": "slack", "provider": "slack", "status": "ACTIVE", "adapter": "known"},
        {"connection": "linear", "provider": "linear", "status": "PENDING", "adapter": "generic"},
    ])
    rows = connections.connections_for("alice")
    assert rows[0] == {"connection": "slack", "provider": "slack", "status": "ACTIVE", "adapter": "known", "link": None}
    assert rows[1]["link"] == "https://auth.example/linear"


def test_connections_empty_for_user_with_nothing(monkeypatch):
    monkeypatch.setattr(connections.mnemosyne, "discover", lambda user_key: [])
    assert connections.connections_for("bob") == []


def test_connections_without_scalekit_configured(monkeypatch):
    monkeypatch.setattr(connections.config, "scalekit_configured", lambda: False)
    assert connections.connections_for("alice") == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `/Users/usmanjameel/company-brain-hackathon/.venv/bin/python -m pytest api/tests/test_graph.py api/tests/test_connections.py -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Write the implementations**

```python
# api/graph.py
"""The user's real Cognee graph, shaped for the web app's brain."""
from __future__ import annotations

from pantheon import cerberus


async def fetch_raw(user_key: str, max_nodes: int) -> dict:
    """Cognee 1.6 internal visualize API. Isolated here so the shape can be stubbed."""
    import uuid

    from cognee.api.v1.visualize.visualize import fetch_visualization_data

    user = await cerberus.get_or_create_user(user_key)
    pairs = await cerberus.readable_dataset_ids(user_key)
    nodes: list[dict] = []
    edges: list[dict] = []
    for name, ds_id in pairs:
        data = await fetch_visualization_data(user=user, dataset=uuid.UUID(ds_id), full=True, max_nodes=max_nodes,
                                              include_session_events=False)
        for n in data.get("nodes", []):
            n.setdefault("properties", {})["dataset"] = name
            nodes.append(n)
        edges.extend(data.get("edges", []))
    return {"nodes": nodes[:max_nodes], "edges": edges}


async def graph_for(user_key: str, max_nodes: int = 600) -> dict:
    raw = await fetch_raw(user_key, max_nodes)
    nodes = [{
        "id": str(n.get("id")),
        "label": n.get("label") or n.get("name") or str(n.get("id"))[:8],
        "type": n.get("type") or "Node",
        "node_set": list((n.get("properties") or {}).get("node_set") or []),
        "dataset": (n.get("properties") or {}).get("dataset"),
    } for n in raw.get("nodes", [])]
    ids = {n["id"] for n in nodes}
    edges = [{"source": str(e.get("source_node_id") or e.get("source")), "target": str(e.get("target_node_id") or e.get("target")),
              "label": e.get("relationship_name") or e.get("label") or ""} for e in raw.get("edges", [])]
    edges = [e for e in edges if e["source"] in ids and e["target"] in ids]
    return {"nodes": nodes, "edges": edges}
```

Before relying on `fetch_visualization_data`, read its signature and the keys it returns in `.venv/lib/python3.12/site-packages/cognee/api/v1/visualize/visualize.py` and adjust the key names in `fetch_raw` to match; the test pins only `graph_for`'s output shape.

```python
# api/connections.py
"""Every system of record this user has connected through Scalekit, for the in-app setup page."""
from __future__ import annotations

from pantheon import config, mnemosyne
from pantheon.mnemosyne import _actions  # the package's own client factory


def connections_for(user_key: str) -> list[dict]:
    if not config.scalekit_configured():
        return []
    identifier = config.USERS[user_key]
    rows = mnemosyne.discover(user_key)
    actions = _actions()
    out = []
    for r in rows:
        link = None
        if r.get("status") != "ACTIVE":
            try:
                link = actions.get_authorization_link(connection_name=r["connection"], identifier=identifier).link
            except Exception:
                link = None
        out.append({**r, "link": link})
    return out
```

Add to `api/server.py`:

```python
from . import connections as conns, graph as graphmod
from pantheon import mnemosyne


class SyncBody(BaseModel):
    user: User
    channels: list[str] = []
    github_repo: str | None = None
    notion_query: str | None = None
    all_sources: bool = True


@app.get("/graph")
async def graph(user: User, max_nodes: int = 600) -> dict:
    async with _locks[user]:
        return await graphmod.graph_for(user, max_nodes)


@app.get("/connections")
def connections(user: User) -> list[dict]:
    return conns.connections_for(user)


@app.post("/sync", dependencies=[Depends(demo_key)])
async def sync(body: SyncBody) -> dict:
    async with _locks[body.user]:
        return await mnemosyne.ingest(body.user, True, body.channels, body.github_repo, body.notion_query, all_sources=body.all_sources)
```

- [ ] **Step 4: Run all API tests**

Run: `/Users/usmanjameel/company-brain-hackathon/.venv/bin/python -m pytest api/tests -v`
Expected: 22 passed

- [ ] **Step 5: Commit**

```bash
git add api/graph.py api/connections.py api/server.py api/tests/test_graph.py api/tests/test_connections.py
git commit -m "api: graph, connections and sync routes"
```
