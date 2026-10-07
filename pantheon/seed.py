"""Seed the fictional Northwind Labs workspace through Scalekit, AS Alice.

Posts the recorded Slack transcripts (sample_data/alice.json) into the real workspace so the
live pull has something to read. Every post is a Scalekit execute_tool call with Alice's
identifier: there is no bot token anywhere. Messages are prefixed with the original author
so the transcript still reads correctly."""
from __future__ import annotations

import time

from . import config
from .mnemosyne import _actions, ensure_authorized, load_recorded


def list_channels(actions, identifier: str) -> dict[str, str]:
    res = actions.execute_tool(
        tool_name="slack_list_channels",
        tool_input={"types": "public_channel,private_channel", "limit": 200},
        connection_name=config.SLACK_CONNECTION,
        identifier=identifier,
    )
    data = res.data or {}
    chans = data.get("channels") or data.get("conversations") or []
    return {c.get("name"): c.get("id") for c in chans if c.get("name")}


def seed_slack(user_key: str = "alice", only_channels: list[str] | None = None, delay_s: float = 0.4) -> dict:
    identifier = config.USERS[user_key]
    actions = _actions()
    if not ensure_authorized(actions, config.SLACK_CONNECTION, identifier):
        raise SystemExit("authorize first: python -m pantheon authorize --user alice")
    recorded = load_recorded(user_key)
    channels = list_channels(actions, identifier)
    posted: dict[str, int] = {}
    for name, msgs in recorded["slack"].items():
        if only_channels and name not in only_channels:
            continue
        channel_id = channels.get(name)
        if not channel_id:
            print(f"[seed] channel #{name} not found in workspace; create it first. have={sorted(channels)}")
            continue
        for m in msgs:
            text = f"*{m['user']}* ({m['ts']}): {m['text']}"
            actions.execute_tool(
                tool_name="slack_send_message",
                tool_input={"channel": channel_id, "text": text},
                connection_name=config.SLACK_CONNECTION,
                identifier=identifier,
            )
            posted[name] = posted.get(name, 0) + 1
            time.sleep(delay_s)
        print(f"[seed] #{name}: {posted.get(name, 0)} messages posted as {identifier}")
    return posted
