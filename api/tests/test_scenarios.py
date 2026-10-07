from api.scenarios import match

SCN = [
    {"id": "pro-price-bob", "as_user": "bob", "question": "What will the Pro plan cost after the Atlas launch?",
     "must_mention": ["$49"], "must_not_mention": ["$59"],
     "after_grant": {"must_mention": ["$59"], "must_not_mention": []}},
    {"id": "pro-price-alice", "as_user": "alice", "question": "What will the Pro plan cost after the Atlas launch?",
     "must_mention": ["$59"]},
]


def test_match_is_case_and_whitespace_insensitive_and_per_user():
    s = match("bob", "  what will the pro plan cost after the atlas launch?  ", False, SCN)
    assert s["id"] == "pro-price-bob"
    assert s["must_mention"] == ["$49"]


def test_match_applies_after_grant_expectations():
    s = match("bob", "What will the Pro plan cost after the Atlas launch?", True, SCN)
    assert s["must_mention"] == ["$59"] and s["must_not_mention"] == []


def test_match_returns_none_for_unknown_question():
    assert match("bob", "Who is on call?", False, SCN) is None
