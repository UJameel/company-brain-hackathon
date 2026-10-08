"""Pristine-state restore for the container.

The image carries the ingested Cognee state as a pristine snapshot. The live copy is
restored from it on first boot and on /reset. The check is a marker file (the relational
database), not "is the directory empty": pantheon.config creates the empty directory
tree at import time, so emptiness is never a reliable signal."""
from __future__ import annotations

import os
import shutil
from pathlib import Path

MARKER = Path("system") / "databases" / "cognee_db"


def restore_if_missing(pristine: Path, live: Path) -> bool:
    """Copy pristine into live when live lacks the Cognee database. Returns True when it copied."""
    if not pristine.is_dir() or not str(live) or (live / MARKER).exists():
        return False
    shutil.copytree(pristine, live, dirs_exist_ok=True)
    return True


def restore_from_env() -> bool:
    """No-op outside the container: both variables must be set (Path("") would mean cwd)."""
    pristine, live = os.environ.get("PRISTINE_STATE_DIR", ""), os.environ.get("LIVE_STATE_DIR", "")
    if not pristine or not live:
        return False
    return restore_if_missing(Path(pristine), Path(live))
