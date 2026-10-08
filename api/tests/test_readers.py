import json

from api import readers


def test_evals_payload_tolerates_missing_files(tmp_path, monkeypatch):
    (tmp_path / "results-after.json").write_text(json.dumps({"label": "after", "n": 1, "mean": 1.0, "rows": []}))
    monkeypatch.setattr(readers.config, "EVALS_DIR", tmp_path)
    p = readers.evals_payload()
    assert p["after"]["mean"] == 1.0
    assert p["before"] is None and p["isolation"] is None
    assert p["change"].startswith("grant alice to bob")


def test_grants_come_from_cognee_via_cerberus(monkeypatch):
    import asyncio

    async def fake_grants():
        return [{"owner": "alice", "grantee": "bob", "dataset": "alice-brain", "permission": "read"}]

    monkeypatch.setattr(readers.cerberus, "grants", fake_grants)
    assert asyncio.run(readers.grants())[0]["grantee"] == "bob"
