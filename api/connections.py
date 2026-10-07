"""Every system of record this user has connected through Scalekit, for the in-app setup page."""
from __future__ import annotations

from pantheon import config, mnemosyne
from pantheon.mnemosyne import _actions  # the package's own client factory


def connections_for(user_key: str) -> list[dict]:
    if not config.scalekit_configured():
        return []
    identifier = config.USERS[user_key]
    rows = mnemosyne.discover(user_key)
    actions = _actions()
    out = []
    for r in rows:
        link = None
        if r.get("status") != "ACTIVE":
            try:
                link = actions.get_authorization_link(connection_name=r["connection"], identifier=identifier).link
            except Exception:
                link = None
        out.append({**r, "link": link})
    return out
