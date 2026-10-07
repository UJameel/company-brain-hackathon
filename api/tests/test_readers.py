import json

from api import readers


def test_evals_payload_tolerates_missing_files(tmp_path, monkeypatch):
    (tmp_path / "results-after.json").write_text(json.dumps({"label": "after", "n": 1, "mean": 1.0, "rows": []}))
    monkeypatch.setattr(readers.config, "EVALS_DIR", tmp_path)
    p = readers.evals_payload()
    assert p["after"]["mean"] == 1.0
    assert p["before"] is None and p["isolation"] is None
    assert p["change"].startswith("grant alice to bob")


def test_grants_reads_state(tmp_path, monkeypatch):
    monkeypatch.setattr(readers.config, "load_state", lambda: {"datasets": {}, "grants": [{"owner": "alice", "grantee": "bob", "dataset": "alice-brain", "permission": "read"}]})
    assert readers.grants()[0]["grantee"] == "bob"
