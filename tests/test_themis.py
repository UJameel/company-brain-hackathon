from pantheon.themis import fact_check


def _res(answer, sources=(), action=None):
    return {"answer": answer, "sources": list(sources), "action": action}


def test_all_facts_and_sources_present_scores_one():
    s = {"must_mention": ["October 21", "Priya"], "expected_sources": ["source:slack"]}
    r = fact_check(s, _res("Launch is October 21, Priya owns it (Slack #general).", ["source:slack"]))
    assert r["fact_score"] == 1.0 and not r["missing"]


def test_leak_zeroes_the_must_not_component():
    s = {"must_mention": ["$49"], "must_not_mention": ["$59"]}
    r = fact_check(s, _res("Pro is $49 now and $59 after launch."))
    assert r["leaks"] == ["$59"] and r["fact_score"] == 0.5


def test_missing_cross_source_grounding_is_partial():
    s = {"must_mention": ["Marco"], "expected_sources": ["source:slack", "source:github"]}
    r = fact_check(s, _res("Marco owns it.", ["source:slack"]))
    assert r["ungrounded"] == ["source:github"] and r["fact_score"] == 0.75


def test_expected_action_requires_matching_tool():
    s = {"must_mention": ["Priya"], "expected_action": "slack_send_message"}
    assert fact_check(s, _res("Ask Priya.", action={"tool": "slack_send_message"}))["fact_score"] == 1.0
    assert fact_check(s, _res("Ask Priya.", action=None))["fact_score"] == 0.5
