from __future__ import annotations

import json
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
# Cognee reads these at import time; they must be set before `import cognee` anywhere.
os.environ.setdefault("ENABLE_BACKEND_ACCESS_CONTROL", "true")
for _var, _sub in (("SYSTEM_ROOT_DIRECTORY", ".cognee_system"), ("DATA_ROOT_DIRECTORY", ".data_storage")):
    _dir = Path(os.environ.get(_var) or (ROOT / _sub))
    (_dir / "databases" if _var == "SYSTEM_ROOT_DIRECTORY" else _dir).mkdir(parents=True, exist_ok=True)
    os.environ[_var] = str(_dir)
os.environ.setdefault("HF_HUB_OFFLINE", "1")

RESPAN_BASE_URL = "https://api.respan.ai/api"
RESPAN_API_KEY = os.environ.get("RESPAN_API_KEY", "")

# Demo identities. The Scalekit `identifier` IS the Cognee user email.
USERS: dict[str, str] = {
    "alice": os.environ.get("USER_ALICE") or "alice@northwind.dev",
    "bob": os.environ.get("USER_BOB") or "bob@northwind.dev",
}
COGNEE_PASSWORD = "hackathon-pw"

# What people are called on screen. Keys, datasets and sample data keep alice/bob.
DISPLAY_NAMES: dict[str, str] = {"alice": os.environ.get("DISPLAY_ALICE", "David"), "bob": os.environ.get("DISPLAY_BOB", "Goliath")}
ROLES: dict[str, str] = {"alice": "Engineering lead", "bob": "Frontend contractor"}


def display(user_key: str) -> str:
    return DISPLAY_NAMES.get(user_key, user_key)


def resolve_user(name: str) -> str:
    """Accept a user key ("alice") or a display name ("David", "goliath"), case-insensitive,
    and return the key. Raises ValueError for anything else."""
    n = (name or "").strip().lower()
    if n in USERS:
        return n
    for key, shown in DISPLAY_NAMES.items():
        if shown.lower() == n:
            return key
    raise ValueError(f"unknown user {name!r}; try one of {sorted(USERS)} or {sorted(DISPLAY_NAMES.values())}")


USER_CHOICES = sorted(set(USERS) | {v.lower() for v in DISPLAY_NAMES.values()})


def dataset_for(user_key: str) -> str:
    return f"{user_key}-brain"


GITHUB_REPO = os.environ.get("GITHUB_REPO", "UJameel/northwind-atlas")
SLACK_CONNECTION = os.environ.get("SLACK_CONNECTION_NAME", "slack")
GITHUB_CONNECTION = os.environ.get("GITHUB_CONNECTION_NAME", "github-connect")
NOTION_CONNECTION = os.environ.get("NOTION_CONNECTION_NAME", "notion")

SAMPLE_DIR = ROOT / "sample_data"
EVALS_DIR = ROOT / "evals"
STATE_FILE = ROOT / ".pantheon_state.json"


def scalekit_configured() -> bool:
    return all(os.environ.get(k) for k in ("SCALEKIT_ENVIRONMENT_URL", "SCALEKIT_CLIENT_ID", "SCALEKIT_CLIENT_SECRET"))


def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {"datasets": {}}


def save_state(state: dict) -> None:
    STATE_FILE.write_text(json.dumps(state, indent=2))
