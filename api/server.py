"""Pantheon HTTP API: the web app's window onto the brain."""
from __future__ import annotations

import asyncio
import json
import os
import shutil
from collections import defaultdict
from pathlib import Path
from typing import Annotated, AsyncIterator, Literal

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, BeforeValidator

from .state import restore_from_env

restore_from_env()  # before pantheon.config runs and creates an empty state tree

from pantheon import cerberus, config, hephaestus, hermes, mnemosyne  # noqa: E402

from . import connections as conns
from . import graph as graphmod
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
User = Annotated[str, BeforeValidator(config.resolve_user)]  # key or display name, resolved to the key


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


class SyncBody(BaseModel):
    user: User
    channels: list[str] = []
    github_repo: str | None = None
    notion_query: str | None = None
    all_sources: bool = True


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
        granted = pipeline.granted_in_scope(body.user, await cerberus.scope(body.user))
    scenario = pipeline.match(body.user, body.question, granted, pipeline.SCENARIOS)
    result["themis"] = {"scenario_id": scenario["id"], **pipeline.themis.fact_check(scenario, result)} if scenario else None
    result["cost_usd"] = pipeline.cost_usd(result["usage"])
    return result


@app.post("/grant", dependencies=[Depends(demo_key)])
async def grant(body: GrantBody) -> dict:
    return {"message": await cerberus.grant(body.owner, body.to), "grants": await readers.grants()}


@app.post("/revoke", dependencies=[Depends(demo_key)])
async def revoke(body: GrantBody) -> dict:
    return {"message": await cerberus.revoke(body.owner, body.to), "grants": await readers.grants()}


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


@app.post("/actions/decline-all", dependencies=[Depends(demo_key)])
async def decline_all() -> dict:
    """Demo reset: decline every pending proposal for every user, in-process (the CLI cannot
    write the decision memory while this server holds the graph lock)."""
    declined: list[str] = []
    for p in list(hephaestus.pending(None)):
        async with _locks[p["user"]]:
            out = await hephaestus.decide(p["id"], "decline", "cleared before the demo")
        if "error" not in out:
            declined.append(p["id"])
    return {"declined": declined}


@app.post("/actions/{action_id}/decide", dependencies=[Depends(demo_key)])
async def decide(action_id: str, body: DecideBody) -> dict:
    user = (hephaestus.get(action_id) or {}).get("user", "alice")
    async with _locks[user]:  # approve may write to Scalekit and the decision is remembered into Cognee
        out = await hephaestus.decide(action_id, body.decision, body.note, dry_run=not body.execute)
    if "error" in out:
        raise HTTPException(404 if out["error"].startswith("no action") else 409, out["error"])
    return out


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


@app.get("/evals")
def evals() -> dict:
    return readers.evals_payload()


@app.get("/scenarios")
def scenarios() -> list[dict]:
    return pipeline.SCENARIOS


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "mode": "live", "users": list(config.USERS), "grants": await readers.grants()}


@app.post("/reset", dependencies=[Depends(demo_key)])
async def reset() -> dict:
    if not (PRISTINE.is_dir() and str(LIVE)):
        raise HTTPException(400, "reset needs PRISTINE_STATE_DIR and LIVE_STATE_DIR")
    shutil.rmtree(LIVE, ignore_errors=True)
    shutil.copytree(PRISTINE, LIVE)
    hephaestus.ACTIONS_LOG.unlink(missing_ok=True)  # proposals and decisions belong to the state being discarded
    asyncio.get_running_loop().call_later(0.3, os._exit, 0)  # Fly restarts the machine
    return {"ok": True, "restarting": True}
