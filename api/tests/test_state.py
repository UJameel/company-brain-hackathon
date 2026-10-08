from pathlib import Path

from api.state import restore_if_missing


def _pristine(tmp_path: Path) -> Path:
    """The snapshot keeps the laptop's directory names: Cognee stores absolute per-user database
    paths, so the live copy must sit at the same absolute path as on the machine that ingested."""
    p = tmp_path / "pristine"
    (p / ".cognee_system" / "databases").mkdir(parents=True)
    (p / ".cognee_system" / "databases" / "cognee_db").write_text("sqlite")
    (p / ".data_storage").mkdir()
    (p / ".data_storage" / "doc.txt").write_text("x")
    return p


def test_restores_when_marker_missing_even_if_dirs_exist(tmp_path):
    """pantheon.config mkdirs the state tree at import; an existing but empty tree must still be restored."""
    pristine = _pristine(tmp_path)
    live = tmp_path / "live"
    (live / ".cognee_system" / "databases").mkdir(parents=True)  # what config.py leaves behind
    assert restore_if_missing(pristine, live) is True
    assert (live / ".cognee_system" / "databases" / "cognee_db").read_text() == "sqlite"
    assert (live / ".data_storage" / "doc.txt").exists()


def test_leaves_existing_state_alone(tmp_path):
    pristine = _pristine(tmp_path)
    live = tmp_path / "live"
    (live / ".cognee_system" / "databases").mkdir(parents=True)
    (live / ".cognee_system" / "databases" / "cognee_db").write_text("live-data")
    assert restore_if_missing(pristine, live) is False
    assert (live / ".cognee_system" / "databases" / "cognee_db").read_text() == "live-data"


def test_noop_without_pristine(tmp_path):
    assert restore_if_missing(tmp_path / "nope", tmp_path / "live") is False


def test_env_restore_is_noop_when_unset(monkeypatch):
    from api.state import restore_from_env

    monkeypatch.delenv("PRISTINE_STATE_DIR", raising=False)
    monkeypatch.delenv("LIVE_STATE_DIR", raising=False)
    assert restore_from_env() is False
