from pathlib import Path

from api.state import restore_if_missing


def _pristine(tmp_path: Path) -> Path:
    p = tmp_path / "pristine"
    (p / "system" / "databases").mkdir(parents=True)
    (p / "system" / "databases" / "cognee_db").write_text("sqlite")
    (p / "data").mkdir()
    (p / "data" / "doc.txt").write_text("x")
    return p


def test_restores_when_marker_missing_even_if_dirs_exist(tmp_path):
    """pantheon.config mkdirs the state tree at import; an existing but empty tree must still be restored."""
    pristine = _pristine(tmp_path)
    live = tmp_path / "live"
    (live / "system" / "databases").mkdir(parents=True)  # what config.py leaves behind
    assert restore_if_missing(pristine, live) is True
    assert (live / "system" / "databases" / "cognee_db").read_text() == "sqlite"
    assert (live / "data" / "doc.txt").exists()


def test_leaves_existing_state_alone(tmp_path):
    pristine = _pristine(tmp_path)
    live = tmp_path / "live"
    (live / "system" / "databases").mkdir(parents=True)
    (live / "system" / "databases" / "cognee_db").write_text("live-data")
    assert restore_if_missing(pristine, live) is False
    assert (live / "system" / "databases" / "cognee_db").read_text() == "live-data"


def test_noop_without_pristine(tmp_path):
    assert restore_if_missing(tmp_path / "nope", tmp_path / "live") is False


def test_env_restore_is_noop_when_unset(monkeypatch):
    from api.state import restore_from_env

    monkeypatch.delenv("PRISTINE_STATE_DIR", raising=False)
    monkeypatch.delenv("LIVE_STATE_DIR", raising=False)
    assert restore_from_env() is False
