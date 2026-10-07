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
