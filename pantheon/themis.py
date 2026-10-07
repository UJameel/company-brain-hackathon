"""Themis (orbitofrontal cortex): outcome evaluation.

An independent scorer: a deterministic fact check (must_mention / must_not_mention /
expected_sources / expected_action) plus an LLM judge on a pinned cheap model that is
not the model Athena answers with. Runs are traced in Respan; results are written to
evals/results-<label>.json so two labels can be compared as before/after."""
from __future__ import annotations

import json
import statistics
import time

from . import config, llm, hermes

JUDGE_SYSTEM = """You are an impartial evaluator. Given a question, the facts a correct answer must
contain, facts it must NOT contain, and the candidate answer, reply with JSON only:
{"score": <0.0-1.0>, "reason": "<one sentence>"}. Score 1.0 if every required fact is present
and no forbidden fact appears. Extra detail that is consistent with the required facts (a year on
a date, a source citation, an added caveat) is fine and must not be penalised. Penalise only facts
that contradict the required ones, invented specifics, or a forbidden fact appearing."""


def fact_check(scenario: dict, result: dict) -> dict:
    ans = result["answer"].lower()
    must = scenario.get("must_mention", [])
    must_not = scenario.get("must_not_mention", [])
    hits = [m for m in must if m.lower() in ans]
    leaks = [m for m in must_not if m.lower() in ans]
    expected_sources = scenario.get("expected_sources", [])
    grounded = [s for s in expected_sources if s in result["sources"]]
    action_ok = True
    if scenario.get("expected_action"):
        action_ok = bool(result.get("action")) and result["action"]["tool"] == scenario["expected_action"]
    parts = []
    if must:
        parts.append(len(hits) / len(must))
    if must_not:
        parts.append(0.0 if leaks else 1.0)
    if expected_sources:
        parts.append(len(grounded) / len(expected_sources))
    if scenario.get("expected_action"):
        parts.append(1.0 if action_ok else 0.0)
    return {
        "fact_score": round(statistics.mean(parts), 3) if parts else 1.0,
        "hits": hits, "missing": [m for m in must if m not in hits], "leaks": leaks,
        "grounded": grounded, "ungrounded": [s for s in expected_sources if s not in grounded],
        "action_ok": action_ok,
    }


def judge(scenario: dict, result: dict) -> dict:
    prompt = (f"Question: {scenario['question']}\nMust contain: {scenario.get('must_mention', [])}\n"
              f"Must NOT contain: {scenario.get('must_not_mention', [])}\nCandidate answer:\n{result['answer']}")
    raw = llm.complete("judge", JUDGE_SYSTEM, prompt, max_tokens=120)
    try:
        return json.loads(raw[raw.find("{") : raw.rfind("}") + 1])
    except Exception:
        return {"score": 0.0, "reason": "judge returned unparseable output"}


def score(scenario: dict, result: dict, use_judge: bool = True) -> dict:
    fc = fact_check(scenario, result)
    j = judge(scenario, result) if use_judge else {"score": None, "reason": "judge disabled"}
    final = fc["fact_score"] if j["score"] is None else round(0.6 * fc["fact_score"] + 0.4 * float(j["score"]), 3)
    return {"final": final, **fc, "judge": j}


async def run(label: str, scenarios_path=None, use_judge: bool = True, only_user: str | None = None) -> dict:
    scenarios = json.loads((scenarios_path or config.EVALS_DIR / "scenarios.json").read_text())
    if only_user:
        scenarios = [s for s in scenarios if s["as_user"] == only_user]
    rows = []
    for s in scenarios:
        t = time.time()
        result = await hermes.ask(s["as_user"], s["question"], dry_run=True)
        sc = score(s, result, use_judge)
        rows.append({"id": s["id"], "as_user": s["as_user"], "question": s["question"], "answer": result["answer"],
                     "sources": result["sources"], "hidden": result["hidden"], "score": sc, "latency_s": round(time.time() - t, 1)})
        print(f"  {sc['final']:.2f}  {s['id']:<24} missing={sc['missing']} leaks={sc['leaks']} ungrounded={sc['ungrounded']}")
    mean = round(statistics.mean(r["score"]["final"] for r in rows), 3)
    out = {"label": label, "n": len(rows), "mean": mean, "models": llm.ROUTES, "rows": rows}
    (config.EVALS_DIR / f"results-{label}.json").write_text(json.dumps(out, indent=2))
    print(f"\n{label}: mean = {mean}  (n = {len(rows)})  -> evals/results-{label}.json")
    return out


def compare(before: str, after: str) -> str:
    b = json.loads((config.EVALS_DIR / f"results-{before}.json").read_text())
    a = json.loads((config.EVALS_DIR / f"results-{after}.json").read_text())
    lines = [f"{'scenario':<24} {'before':>7} {'after':>7}"]
    amap = {r["id"]: r for r in a["rows"]}
    for r in b["rows"]:
        ar = amap.get(r["id"])
        lines.append(f"{r['id']:<24} {r['score']['final']:>7.2f} {(ar['score']['final'] if ar else float('nan')):>7.2f}")
    lines.append(f"\nBefore: mean = {b['mean']}   (n = {b['n']})\nAfter:  mean = {a['mean']}   (n = {a['n']})")
    return "\n".join(lines)
