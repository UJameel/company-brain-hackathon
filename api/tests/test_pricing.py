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
