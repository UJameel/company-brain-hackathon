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
