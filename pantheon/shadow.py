"""Themis grades the router: run a local model in shadow against the gateway models on the
scenario questions (routing) and on stored answers (judging), and report agreement.
Nothing touches Cognee; this is pure model-vs-model comparison."""
from __future__ import annotations

import json
import statistics
import time

from . import config, llm, hermes, themis

EXTRA_QUESTIONS = [
    "Post a summary of the Paddle migration status to #engineering.",
    "File a ticket for the pricing page to show $59 after launch.",
    "Who is on leave next week?",
]


def _with_local(model: str | None, enabled: bool):
    """Temporarily point llm at a local model (or disable local) for the duration of a call."""
    prev = (llm.LOCAL_ENABLED, llm.LOCAL_MODEL, llm._local_down)
    llm.LOCAL_ENABLED, llm._local_down = enabled, False
    if model:
        llm.LOCAL_MODEL = model
    return prev


def _restore(prev):
    llm.LOCAL_ENABLED, llm.LOCAL_MODEL, llm._local_down = prev


def router(model: str) -> dict:
    qs = [s["question"] for s in json.loads((config.EVALS_DIR / "scenarios.json").read_text())] + EXTRA_QUESTIONS
    rows, agree, tl, tg = [], 0, 0.0, 0.0
    for q in qs:
        prev = _with_local(model, True)
        t = time.time(); local = hermes.route(q, llm.Usage()); dl = time.time() - t
        _restore(prev)
        prev = _with_local(None, False)
        t = time.time(); gw = hermes.route(q, llm.Usage()); dg = time.time() - t
        _restore(prev)
        same = (local.get("intent"), local.get("action_tool")) == (gw.get("intent"), gw.get("action_tool"))
        agree += same; tl += dl; tg += dg
        rows.append({"question": q, "local": f"{local.get('intent')}/{local.get('action_tool')}", "gateway": f"{gw.get('intent')}/{gw.get('action_tool')}", "agree": same, "local_s": round(dl, 2), "gateway_s": round(dg, 2)})
        print(("  ok " if same else "DIFF") + f" local={rows[-1]['local']:<30} gw={rows[-1]['gateway']:<30} {dl:.2f}s vs {dg:.2f}s  {q[:52]}")
    print(f"\nROUTER {model}: agreement {agree}/{len(qs)}, mean latency local {tl/len(qs):.2f}s vs gateway {tg/len(qs):.2f}s")
    return {"model": model, "agree": agree, "n": len(qs), "rows": rows}


def judge(model: str, label: str) -> dict:
    """Re-judge the stored answers of results-<label>.json with the local model and compare to the stored scores."""
    out = json.loads((config.EVALS_DIR / f"results-{label}.json").read_text())
    scen = {s["id"]: s for s in themis.load_scenarios(out.get("stage", "isolated"))}
    prev = _with_local(model, True)
    diffs, finals = [], []
    try:
        for r in out["rows"]:
            result = {"answer": r["answer"], "sources": r["sources"], "action": r.get("action") or ({"tool": scen[r["id"]].get("expected_action")} if r["score"].get("action_ok") and scen[r["id"]].get("expected_action") else None)}
            sc = themis.score(scen[r["id"]], result, True)
            finals.append(sc["final"])
            if abs(sc["final"] - r["score"]["final"]) > 0.01:
                diffs.append((r["id"], r["score"]["final"], sc["final"]))
    finally:
        _restore(prev)
    mean = round(statistics.mean(finals), 3)
    print(f"JUDGE {model} on {label}: mean {mean} vs stored {out['mean']} ({out.get('models', {}).get('judge')}); disagreements {len(diffs)}/{len(finals)}: {diffs or 'none'}")
    return {"model": model, "label": label, "mean": mean, "stored_mean": out["mean"], "disagreements": diffs}


def run(model: str, labels: list[str]) -> dict:
    report = {"router": router(model), "judge": [judge(model, l) for l in labels if (config.EVALS_DIR / f"results-{l}.json").exists()]}
    (config.EVALS_DIR / f"shadow-{model.replace(':', '-').replace('/', '-')}.json").write_text(json.dumps(report, indent=2))
    return report
