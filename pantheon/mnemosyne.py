"""Mnemosyne (hippocampus): memory encoding.

Pulls from each connected app AS EACH USER through Scalekit, turns every item into a
provenance-tagged text document, and remembers it into that user's Cognee dataset.
Every live pull is also recorded to sample_data/<user>.json so judges can replay the
whole pipeline without the same SaaS accounts, and so the eval is reproducible."""
from __future__ import annotations

import json
from datetime import datetime, timezone

from . import config
from .cerberus import get_or_create_user

import cognee


# ---------- pull (Scalekit, live) ----------------------------------------------------

def _actions():
    import os
    from scalekit import ScalekitClient

    return ScalekitClient(
        env_url=os.environ["SCALEKIT_ENVIRONMENT_URL"],
        client_id=os.environ["SCALEKIT_CLIENT_ID"],
        client_secret=os.environ["SCALEKIT_CLIENT_SECRET"],
    ).actions


def ensure_authorized(actions, connection_name: str, identifier: str) -> bool:
    account = actions.get_or_create_connected_account(connection_name=connection_name, identifier=identifier)
    status = getattr(account.connected_account, "status", "")
    if status == "ACTIVE":
        return True
    link = actions.get_authorization_link(connection_name=connection_name, identifier=identifier)
    print(f"[cerberus] {identifier} must authorize {connection_name}: {link.link}")
    return False


def pull_live(user_key: str, channels: list[str], github_repo: str | None) -> dict:
    """Pull Slack channels (and optionally a GitHub repo) as this user. Items the user's
    token cannot see simply do not come back: that is the access boundary, enforced upstream."""
    identifier = config.USERS[user_key]
    actions = _actions()
    pulled: dict = {"user": user_key, "pulled_at": datetime.now(timezone.utc).isoformat(), "slack": {}, "github": None}

    if ensure_authorized(actions, config.SLACK_CONNECTION, identifier):
        for ch in channels:
            try:
                res = actions.execute_tool(
                    tool_name="slack_fetch_conversation_history",
                    tool_input={"channel": ch, "limit": 200},
                    connection_name=config.SLACK_CONNECTION,
                    identifier=identifier,
                )
                msgs = (res.data or {}).get("messages", [])
                pulled["slack"][ch.lstrip("#")] = [
                    {"user": m.get("user", "?"), "ts": m.get("ts", ""), "text": m.get("text", "")}
                    for m in reversed(msgs) if m.get("text")
                ]
            except Exception as e:  # channel private to this user, or not a member
                print(f"[mnemosyne] {identifier} cannot read {ch}: {str(e)[:120]}")

    if github_repo and ensure_authorized(actions, config.GITHUB_CONNECTION, identifier):
        owner, repo = github_repo.split("/")
        gh = {"repo": github_repo, "issues": [], "pulls": [], "files": {}}
        try:
            issues = actions.execute_tool(tool_name="githubpat_issues_list", tool_input={"owner": owner, "repo": repo, "state": "all"},
                                          connection_name=config.GITHUB_CONNECTION, identifier=identifier).data
            for it in issues if isinstance(issues, list) else issues.get("items", issues.get("data", [])):
                entry = {"number": it.get("number"), "title": it.get("title"), "state": it.get("state"),
                         "assignee": (it.get("assignee") or {}).get("login"), "body": it.get("body") or "",
                         "labels": [l.get("name") for l in it.get("labels", [])]}
                (gh["pulls"] if it.get("pull_request") else gh["issues"]).append(entry)
        except Exception as e:
            print(f"[mnemosyne] github pull failed: {str(e)[:160]}")
        pulled["github"] = gh

    (config.SAMPLE_DIR / f"{user_key}.json").write_text(json.dumps(pulled, indent=2))
    return pulled


def load_recorded(user_key: str) -> dict:
    return json.loads((config.SAMPLE_DIR / f"{user_key}.json").read_text())


# ---------- encode (text + node_set) --------------------------------------------------

def documents(pulled: dict) -> list[tuple[str, list[str]]]:
    """One document per channel / per GitHub artefact. The provenance header is in the
    text as well as in node_set, so retrieved chunks carry their source with them."""
    user_key = pulled["user"]
    docs: list[tuple[str, list[str]]] = []
    for channel, msgs in (pulled.get("slack") or {}).items():
        tags = ["source:slack", f"channel:{channel}", f"owner:{user_key}"]
        header = f"[source:slack channel:#{channel} pulled-as:{user_key}]"
        lines = [f"[slack #{channel} · {m['user']} · {m['ts']}] {m['text']}" for m in msgs]
        docs.append((header + "\nSlack channel #" + channel + " transcript:\n" + "\n".join(lines), tags))
    gh = pulled.get("github")
    if gh:
        repo = gh.get("repo", "repo")
        for it in gh.get("issues", []):
            tags = ["source:github", f"repo:{repo}", "kind:issue", f"owner:{user_key}"]
            docs.append((f"[source:github repo:{repo} issue:#{it['number']} pulled-as:{user_key}]\n"
                         f"GitHub issue #{it['number']} in {repo}: {it['title']}\nState: {it['state']}. "
                         f"Assignee: {it.get('assignee')}. Labels: {', '.join(it.get('labels') or [])}.\n{it.get('body','')}", tags))
        for pr in gh.get("pulls", []):
            tags = ["source:github", f"repo:{repo}", "kind:pull_request", f"owner:{user_key}"]
            docs.append((f"[source:github repo:{repo} pr:#{pr['number']} pulled-as:{user_key}]\n"
                         f"GitHub pull request #{pr['number']} in {repo}: {pr['title']}\nState: {pr['state']}. "
                         f"Author: {pr.get('author') or pr.get('assignee')}.\n{pr.get('body','')}\n"
                         f"Files: {', '.join(pr.get('files_changed') or [])}", tags))
        for path, content in (gh.get("files") or {}).items():
            tags = ["source:github", f"repo:{repo}", "kind:file", f"owner:{user_key}"]
            docs.append((f"[source:github repo:{repo} file:{path} pulled-as:{user_key}]\n{content}", tags))
    return docs


async def remember(user_key: str, pulled: dict) -> dict:
    """Permanent graph memory, one dataset per user, tagged by source."""
    user = await get_or_create_user(user_key)
    dataset = config.dataset_for(user_key)
    docs = documents(pulled)
    sources: set[str] = set()
    for text, tags in docs:
        await cognee.remember(text, dataset_name=dataset, user=user, node_set=tags)
        sources.update(t for t in tags if t.startswith("source:"))
    state = config.load_state()
    state.setdefault("datasets", {})[dataset] = {"owner": user_key, "sources": sorted(sources), "documents": len(docs)}
    config.save_state(state)
    return {"dataset": dataset, "documents": len(docs), "sources": sorted(sources)}


async def ingest(user_key: str, live: bool, channels: list[str], github_repo: str | None) -> dict:
    pulled = pull_live(user_key, channels, github_repo) if live else load_recorded(user_key)
    return await remember(user_key, pulled)
