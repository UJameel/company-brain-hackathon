"""Mnemosyne (hippocampus): memory encoding.

Pulls from every system of record the user has connected, AS THAT USER, through Scalekit, turns every item into a
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


def _rows(data):
    """Scalekit wraps list responses as {"array": [...]}; tolerate a bare list too."""
    if isinstance(data, dict):
        return data.get("array") or data.get("results") or data.get("items") or data.get("data") or []
    return data or []


def pull_live(user_key: str, channels: list[str], github_repo: str | None, notion_query: str | None = None) -> dict:
    """Pull Slack channels, a GitHub repo and Notion pages AS this user. Items the user's
    tokens cannot see simply do not come back: that is the access boundary, enforced upstream.
    A connection the user never authorized yields nothing from that source."""
    identifier = config.USERS[user_key]
    actions = _actions()
    recorded = load_recorded(user_key) if (config.SAMPLE_DIR / f"{user_key}.json").exists() else {}
    pulled: dict = {"user": user_key, "pulled_at": datetime.now(timezone.utc).isoformat(), "slack": {}, "github": None, "notion": None,
                    "live": {"slack": False, "github": False, "notion": False}}

    # --- Slack ---
    if channels and ensure_authorized(actions, config.SLACK_CONNECTION, identifier):
        for ch in channels:
            try:
                res = actions.execute_tool(tool_name="slack_fetch_conversation_history", tool_input={"channel": ch, "limit": 200},
                                           connection_name=config.SLACK_CONNECTION, identifier=identifier)
                msgs = (res.data or {}).get("messages", [])
                pulled["slack"][ch.lstrip("#")] = [{"user": m.get("user", "?"), "ts": m.get("ts", ""), "text": m.get("text", "")}
                                                    for m in reversed(msgs) if m.get("text")]
                pulled["live"]["slack"] = True
            except Exception as e:
                print(f"[mnemosyne] {identifier} cannot read {ch}: {str(e).splitlines()[0][:120]}")
    if not pulled["slack"] and recorded.get("slack"):
        pulled["slack"] = recorded["slack"]          # replay the recorded Northwind transcripts
        print(f"[mnemosyne] slack: replaying recorded pull for {user_key}")

    # --- GitHub ---
    if github_repo and ensure_authorized(actions, config.GITHUB_CONNECTION, identifier):
        owner, repo = github_repo.split("/")
        gh = {"repo": github_repo, "issues": [], "pulls": [], "files": {}}
        try:
            for it in _rows(actions.execute_tool(tool_name="github_issues_list", tool_input={"owner": owner, "repo": repo, "state": "all"},
                                                 connection_name=config.GITHUB_CONNECTION, identifier=identifier).data):
                if it.get("pull_request"):
                    continue
                gh["issues"].append({"number": int(it.get("number")), "title": it.get("title"), "state": it.get("state"),
                                     "assignee": (it.get("assignee") or {}).get("login"), "body": it.get("body") or "",
                                     "labels": [l.get("name") for l in it.get("labels", [])]})
            for pr in _rows(actions.execute_tool(tool_name="github_pull_requests_list", tool_input={"owner": owner, "repo": repo, "state": "all"},
                                                 connection_name=config.GITHUB_CONNECTION, identifier=identifier).data):
                gh["pulls"].append({"number": int(pr.get("number")), "title": pr.get("title"), "state": pr.get("state"),
                                    "author": (pr.get("user") or {}).get("login"), "body": pr.get("body") or "",
                                    "files_changed": []})
            import base64
            f = actions.execute_tool(tool_name="github_file_contents_get", tool_input={"owner": owner, "repo": repo, "path": "README.md"},
                                     connection_name=config.GITHUB_CONNECTION, identifier=identifier).data
            if isinstance(f, dict) and f.get("content"):
                gh["files"]["README.md"] = base64.b64decode(f["content"]).decode("utf-8", "replace")
            pulled["live"]["github"] = True
        except Exception as e:
            print(f"[mnemosyne] github pull failed: {str(e).splitlines()[0][:160]}")
        pulled["github"] = gh

    # --- Notion ---
    if notion_query and ensure_authorized(actions, config.NOTION_CONNECTION, identifier):
        pages = []
        try:
            res = actions.execute_tool(tool_name="notion_page_search", tool_input={"query": notion_query},
                                       connection_name=config.NOTION_CONNECTION, identifier=identifier).data
            for pg in _rows(res)[:5]:
                pid = pg.get("id")
                title = "".join(t.get("plain_text", "") for t in ((pg.get("properties") or {}).get("title") or {}).get("title", [])) or pg.get("title") or pid
                md = actions.execute_tool(tool_name="notion_page_markdown_get", tool_input={"page_id": pid},
                                          connection_name=config.NOTION_CONNECTION, identifier=identifier).data
                text = md if isinstance(md, str) else (md.get("markdown") or md.get("content") or json.dumps(md))
                pages.append({"id": pid, "title": title, "markdown": text})
            pulled["live"]["notion"] = True
        except Exception as e:
            print(f"[mnemosyne] notion pull failed: {str(e).splitlines()[0][:160]}")
        pulled["notion"] = {"pages": pages}

    (config.SAMPLE_DIR / f"{user_key}.live.json").write_text(json.dumps(pulled, indent=2))
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
    for pg in ((pulled.get("notion") or {}).get("pages") or []):
        tags = ["source:notion", f"page:{pg['title'][:40]}", f"owner:{user_key}"]
        docs.append((f"[source:notion page:{pg['title']} pulled-as:{user_key}]\nNotion page: {pg['title']}\n{pg['markdown']}", tags))
    return docs


async def remember(user_key: str, pulled: dict) -> dict:
    """Permanent graph memory, one dataset per user, tagged by source."""
    user = await get_or_create_user(user_key)
    dataset = config.dataset_for(user_key)
    docs = documents(pulled)
    sources: set[str] = set()
    all_tags: set[str] = set()
    for text, tags in docs:
        await cognee.remember(text, dataset_name=dataset, user=user, node_set=tags)
        sources.update(t for t in tags if t.startswith("source:"))
        all_tags.update(t for t in tags if not t.startswith("owner:"))
    state = config.load_state()
    state.setdefault("datasets", {})[dataset] = {"owner": user_key, "sources": sorted(sources), "tags": sorted(all_tags), "documents": len(docs)}
    config.save_state(state)
    return {"dataset": dataset, "documents": len(docs), "sources": sorted(sources)}


async def remember_docs(user_key: str, docs: list[tuple[str, list[str]]], manifest: list[dict] | None = None) -> dict:
    user = await get_or_create_user(user_key)
    dataset = config.dataset_for(user_key)
    sources: set[str] = set()
    all_tags: set[str] = set()
    for text, tags in docs:
        await cognee.remember(text, dataset_name=dataset, user=user, node_set=tags)
        sources.update(t for t in tags if t.startswith("source:"))
        all_tags.update(t for t in tags if not t.startswith("owner:"))
    state = config.load_state()
    entry = state.setdefault("datasets", {}).setdefault(dataset, {"owner": user_key, "sources": [], "tags": [], "documents": 0})
    entry["sources"] = sorted(set(entry.get("sources", [])) | sources)
    entry["tags"] = sorted(set(entry.get("tags", [])) | all_tags)
    entry["documents"] = entry.get("documents", 0) + len(docs)
    if manifest is not None:
        entry["systems"] = manifest
    config.save_state(state)
    return {"dataset": dataset, "documents": len(docs), "sources": sorted(sources), "systems": manifest}


def discover(user_key: str) -> list[dict]:
    """The systems of record this user has connected through Scalekit."""
    from . import sources

    return sources.discover(_actions(), config.USERS[user_key])


async def ingest(user_key: str, live: bool, channels: list[str], github_repo: str | None, notion_query: str | None = None,
                 all_sources: bool = False, **options) -> dict:
    """Recorded replay, the three demo sources, or (all_sources=True) every system the user
    has connected: known connectors through their adapters, everything else generically."""
    if live and all_sources:
        from . import sources

        docs, manifest = sources.pull_all(_actions(), config.USERS[user_key], user_key,
                                          {"channels": channels, "github_repo": github_repo, "notion_query": notion_query, **options})
        if not any(t.startswith("source:slack") for _, tags in docs for t in tags):
            rec = load_recorded(user_key) if (config.SAMPLE_DIR / f"{user_key}.json").exists() else {}
            if rec.get("slack"):
                docs += [d for d in documents({**rec, "github": None, "notion": None}) ]
                manifest.append({"connection": "slack", "provider": "slack", "status": "RECORDED", "adapter": "recorded", "documents": len(rec["slack"])})
                print(f"[mnemosyne] slack: replaying recorded pull for {user_key}")
        (config.SAMPLE_DIR / f"{user_key}.live.json").write_text(json.dumps({"user": user_key, "manifest": manifest, "documents": [t for t, _ in docs]}, indent=2))
        return await remember_docs(user_key, docs, manifest)
    pulled = pull_live(user_key, channels, github_repo, notion_query) if live else load_recorded(user_key)
    return await remember(user_key, pulled)
