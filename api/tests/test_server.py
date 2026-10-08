import json

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
    async def no_grants():
        return []

    monkeypatch.setattr(server.readers, "grants", no_grants)
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


def test_ask_scores_with_scope_derived_grant(client, monkeypatch):
    async def fake_ask(user, question, dry_run=True):
        return {"user": user, "question": question, "answer": "Pro is $49.", "sources": ["source:slack"], "hidden": [], "action": None,
                "suggested_actions": [], "usage": [{"step": "route", "model": "gpt-4o-mini", "prompt_tokens": 100, "completion_tokens": 0}], "feed": [], "latency_s": 1.0}

    async def shared_scope(user):
        return {"readable": ["alice-brain", "bob-brain"], "readable_ids": ["1", "2"], "hidden": {}}

    monkeypatch.setattr(server.hermes, "ask", fake_ask)
    monkeypatch.setattr(server.cerberus, "scope", shared_scope)
    monkeypatch.setattr(server.pipeline, "SCENARIOS", [
        {"id": "pro-price-bob", "as_user": "bob", "question": "Q?", "must_mention": ["$59"], "after_grant": {"must_mention": ["$49"]}},
    ])
    r = client.post("/ask", json={"user": "bob", "question": "Q?"})
    assert r.status_code == 200
    assert r.json()["themis"]["fact_score"] == 1.0 and r.json()["cost_usd"] == 0.000015


def test_decline_all_clears_every_pending_proposal(client, monkeypatch):
    pend = [{"id": "a1", "user": "bob", "tool": "request_access", "input": {}, "status": "proposed"},
            {"id": "a2", "user": "alice", "tool": "slack_send_message", "input": {}, "status": "proposed"}]
    monkeypatch.setattr(server.hephaestus, "pending", lambda user_key=None: [p for p in pend if p["status"] == "proposed" and user_key in (None, p["user"])])
    monkeypatch.setattr(server.hephaestus, "get", lambda action_id: next((p for p in pend if p["id"] == action_id), None))

    async def decide(action_id, decision, note=None, dry_run=True):
        p = next(p for p in pend if p["id"] == action_id); p["status"] = "declined"
        return {"decision": decision, "action": p}

    monkeypatch.setattr(server.hephaestus, "decide", decide)
    assert client.post("/actions/decline-all").status_code == 401
    r = client.post("/actions/decline-all", headers={"X-Demo-Key": "k"})
    assert r.status_code == 200 and r.json() == {"declined": ["a1", "a2"]}
    assert client.get("/actions").json() == []


def test_health_reports_mode(client):
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["ok"] is True and r.json()["users"] == ["alice", "bob"]


def test_actions_list_and_decide(client, monkeypatch):
    pend = [{"id": "a1", "user": "bob", "tool": "request_access", "input": {}, "status": "proposed"}]
    monkeypatch.setattr(server.hephaestus, "pending", lambda user_key=None: [p for p in pend if user_key in (None, p["user"])])
    monkeypatch.setattr(server.hephaestus, "get", lambda action_id: pend[0] if action_id == "a1" else None)
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
    """Two chats for the same user never overlap: the second waits for the first's lock.
    Driven at the handler level with asyncio.gather; TestClient cannot interleave two
    blocking calls that share an asyncio.Lock."""
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
