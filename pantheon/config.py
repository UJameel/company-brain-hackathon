from __future__ import annotations

import json
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
# Cognee reads this at import time; it must be set before `import cognee` anywhere.
os.environ.setdefault("ENABLE_BACKEND_ACCESS_CONTROL", "true")

RESPAN_BASE_URL = "https://api.respan.ai/api"
RESPAN_API_KEY = os.environ.get("RESPAN_API_KEY", "")

# Demo identities. The Scalekit `identifier` IS the Cognee user email.
USERS: dict[str, str] = {
    "alice": os.environ.get("USER_ALICE") or "alice@northwind.dev",
    "bob": os.environ.get("USER_BOB") or "bob@northwind.dev",
}
COGNEE_PASSWORD = "hackathon-pw"


def dataset_for(user_key: str) -> str:
    return f"{user_key}-brain"


SLACK_CONNECTION = os.environ.get("SLACK_CONNECTION_NAME", "slack")
GITHUB_CONNECTION = os.environ.get("GITHUB_CONNECTION_NAME", "githubpat")

SAMPLE_DIR = ROOT / "sample_data"
EVALS_DIR = ROOT / "evals"
STATE_FILE = ROOT / ".pantheon_state.json"


def scalekit_configured() -> bool:
    return all(os.environ.get(k) for k in ("SCALEKIT_ENVIRONMENT_URL", "SCALEKIT_CLIENT_ID", "SCALEKIT_CLIENT_SECRET"))


def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {"datasets": {}, "grants": []}


def save_state(state: dict) -> None:
    STATE_FILE.write_text(json.dumps(state, indent=2))
