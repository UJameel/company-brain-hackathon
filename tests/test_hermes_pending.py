from pantheon import hermes, hephaestus


def test_decision_candidates_are_only_the_latest_turn(monkeypatch):
    items = [
        {"id": "old1", "question": "earlier question", "created_at": "2026-10-07T20:00:00+00:00"},
        {"id": "new1", "question": "latest question", "created_at": "2026-10-07T21:00:00+00:00"},
        {"id": "new2", "question": "latest question", "created_at": "2026-10-07T21:00:05+00:00"},
    ]
    monkeypatch.setattr(hephaestus, "pending", lambda user: items)
    hermes._route_user.append("bob")
    try:
        ids = [p["id"] for p in hermes._pending_for(None)]
    finally:
        hermes._route_user.pop()
    assert ids == ["new2", "new1"]
