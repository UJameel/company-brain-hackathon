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
