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
    # the acting identity comes from config.USERS, which .env may override
    assert done["feed"][-1] == f"Hephaestus: slack_send_message dry-run as {pipeline.config.USERS['alice']}"


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


def test_granted_is_derived_from_scope_not_state_file(fake_backend, monkeypatch):
    """Cognee is the source of truth for sharing: when Bob can read a dataset he does not own,
    Themis scores against the after-grant expectations even if the state file says nothing."""
    async def shared_scope(user_key):
        return {"user": user_key, "identifier": "bob@northwind.dev", "readable": ["alice-brain", "bob-brain"],
                "readable_ids": ["1", "2"], "hidden": {}}

    monkeypatch.setattr(pipeline.hermes, "_scope", shared_scope)
    monkeypatch.setattr(pipeline, "SCENARIOS", [
        {"id": "pro-price-bob", "as_user": "bob", "question": "What will the Pro plan cost after the Atlas launch?",
         "must_mention": ["$59"], "must_not_mention": ["$49"],
         "after_grant": {"must_mention": ["$49"], "must_not_mention": ["$1000"]}},
    ])
    done = asyncio.run(collect())[-1][1]
    assert done["themis"]["fact_score"] == 1.0  # after_grant expectations applied: $49 present, $1000 absent


def test_stream_synthesize_records_usage_with_provider(monkeypatch):
    """The real streaming path must record the synthesize usage row the way llm.Usage expects
    (step, provider, model, resp); a wrong call here silently falls back to a second full completion."""
    from types import SimpleNamespace

    chunks = [
        SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content="Pro "))], usage=None),
        SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content="is $49."))], usage=None),
        SimpleNamespace(choices=[], usage=SimpleNamespace(prompt_tokens=800, completion_tokens=40)),
    ]

    class FakeCompletions:
        def create(self, **kw):
            assert kw["stream"] is True
            return iter(chunks)

    monkeypatch.setattr(pipeline.llm, "client", lambda: SimpleNamespace(chat=SimpleNamespace(completions=FakeCompletions())))
    usage = pipeline.llm.Usage()

    async def drain():
        return [p async for p in pipeline.stream_synthesize("prompt", usage)]

    assert "".join(asyncio.run(drain())) == "Pro is $49."
    assert len(usage.calls) == 1
    row = usage.calls[0]
    assert row["step"] == "synthesize" and row["provider"] == "respan" and row["prompt_tokens"] == 800 and row["completion_tokens"] == 40


def test_fallback_token_event_replaces_partial_text(fake_backend, monkeypatch):
    async def broken(prompt, usage):
        yield "The Pro "
        raise RuntimeError("gateway closed")

    monkeypatch.setattr(pipeline, "stream_synthesize", broken)
    monkeypatch.setattr(pipeline.llm, "complete", lambda step, system, user, usage=None, max_tokens=700: "The Pro plan costs $49.")
    events = asyncio.run(collect())
    tokens = [d for n, d in events if n == "athena.token"]
    assert tokens[-1] == {"text": "The Pro plan costs $49.", "replace": True}


def test_decision_turn_applies_the_proposal_without_recall(fake_backend, monkeypatch):
    """A plain-language reply to a pending proposal ("yes send it") routes as a decision:
    Hephaestus decides, nothing is recalled, and the turn reports the outcome."""
    seen_route_user = []

    def route(question, usage):
        seen_route_user.append(list(pipeline.hermes._route_user))  # hermes.route reads pending proposals through this
        return {"intent": "decision", "decision": "approve", "proposal_id": "a1", "action_tool": None}

    async def decide(action_id, decision, note=None, dry_run=True):
        assert (action_id, decision, note, dry_run) == ("a1", "approve", None, True)
        return {"decision": "approve", "action": {"id": "a1", "user": "bob", "tool": "slack_send_message", "status": "approved-dry-run",
                                                   "as_user": "bob@northwind.dev", "input": {"channel": "#general", "text": "hi"}}}

    async def recall_should_not_run(*a, **k):
        raise AssertionError("recall must not run for a decision turn")

    monkeypatch.setattr(pipeline.hermes, "route", route)
    monkeypatch.setattr(pipeline.hephaestus, "decide", decide)
    monkeypatch.setattr(pipeline.athena, "recall", recall_should_not_run)
    events = asyncio.run(collect(user="bob", question="yes send it"))
    names = [n for n, _ in events]
    assert names == ["hermes", "hephaestus.decided", "done"]
    assert seen_route_user == [["bob"]] and pipeline.hermes._route_user == []
    assert events[0][1]["intent"] == "decision" and events[0][1]["decision"] == "approve"
    done = events[-1][1]
    assert done["decision"]["action"]["status"] == "approved-dry-run"
    assert done["answer"].startswith("Approved (dry run") and done["sources"] == [] and done["hidden"] == []
    assert done["suggested_actions"] == [] and done["themis"] is None


def test_revise_decision_streams_the_new_proposal(fake_backend, monkeypatch):
    monkeypatch.setattr(pipeline.hermes, "route", lambda q, u: {"intent": "decision", "decision": "revise", "proposal_id": "a1"})
    new = {"id": "a2", "user": "bob", "as_user": "bob@northwind.dev", "tool": "slack_send_message", "input": {"channel": "#general", "text": "shorter"},
           "rationale": "r", "origin": "revised", "status": "proposed", "parent": "a1", "created_at": "t"}

    async def decide(action_id, decision, note=None, dry_run=True):
        assert note == "make it shorter"
        return {"decision": "revise", "superseded": "a1", "proposal": new}

    monkeypatch.setattr(pipeline.hephaestus, "decide", decide)
    events = asyncio.run(collect(user="bob", question="make it shorter"))
    names = [n for n, _ in events]
    assert names == ["hermes", "hephaestus.decided", "hephaestus.proposed", "done"]
    assert events[2][1] == {"proposals": [new]}
    assert events[-1][1]["suggested_actions"] == [new] and events[-1][1]["answer"].startswith("Revised.")


def test_build_prompt_mirrors_athena():
    scope = {"identifier": "bob@northwind.dev", "hidden": {"alice-brain": {"owner": "alice", "extra": ["channel:leadership"]}}}
    p = pipeline.build_prompt("bob", "Q?", scope, ["[source:slack pulled-as:bob] hello"])
    assert "User: bob (bob@northwind.dev)" in p
    assert "pulled-as" not in p
    assert "HIDDEN (exists, not readable by this user):" in p and "alice-brain (owner: alice, contains: channel:leadership)" in p
