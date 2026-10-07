"""Systems of record. Wherever the company lives, Pantheon pulls it.

A source is any Scalekit connection the user has authorised. Known connectors get a
hand-written adapter that turns their records into well-shaped documents; every other
connector goes through the generic adapter, which asks Scalekit for the connection's
read-only, argument-free tools and remembers whatever they return. Discovery is per user:
the brain for Alice is built from exactly the systems Alice connected, nothing more."""
from __future__ import annotations

import base64
import json
from typing import Callable

from . import config

Doc = tuple[str, list[str]]  # (text, node_set tags)
Adapter = Callable[[object, str, str, dict], list[Doc]]  # (actions, identifier, user_key, options) -> docs

MAX_DOC_CHARS = 20_000
GENERIC_MAX_TOOLS = 6


def _rows(data):
    if isinstance(data, dict):
        for k in ("array", "results", "items", "messages", "issues", "events", "files", "records", "data", "value"):
            v = data.get(k)
            if isinstance(v, list):
                return v
        return []
    return data or []


def _hdr(source: str, user_key: str, **kv) -> str:
    extra = " ".join(f"{k}:{v}" for k, v in kv.items() if v is not None)
    return f"[source:{source} {extra} pulled-as:{user_key}]".replace("  ", " ")


# ---------------------------------------------------------------- known adapters

def slack(actions, identifier, user_key, opt) -> list[Doc]:
    docs: list[Doc] = []
    for ch in opt.get("channels") or []:
        res = actions.execute_tool(tool_name="slack_fetch_conversation_history", tool_input={"channel": ch, "limit": 200},
                                   connection_name=opt["connection"], identifier=identifier)
        msgs = [m for m in reversed(_rows(res.data)) if m.get("text")]
        name = ch.lstrip("#")
        lines = [f"[slack #{name} · {m.get('user', '?')} · {m.get('ts', '')}] {m['text']}" for m in msgs]
        docs.append((_hdr("slack", user_key, channel=f"#{name}") + f"\nSlack channel #{name} transcript:\n" + "\n".join(lines),
                     ["source:slack", f"channel:{name}", f"owner:{user_key}"]))
    return docs


def github(actions, identifier, user_key, opt) -> list[Doc]:
    repo_full = opt.get("github_repo")
    if not repo_full:
        return []
    owner, repo = repo_full.split("/")
    conn = opt["connection"]
    docs: list[Doc] = []
    for it in _rows(actions.execute_tool(tool_name="github_issues_list", tool_input={"owner": owner, "repo": repo, "state": "all"},
                                         connection_name=conn, identifier=identifier).data):
        if it.get("pull_request"):
            continue
        n = int(it.get("number"))
        docs.append((_hdr("github", user_key, repo=repo_full, issue=f"#{n}") + f"\nGitHub issue #{n} in {repo_full}: {it.get('title')}\n"
                     f"State: {it.get('state')}. Assignee: {(it.get('assignee') or {}).get('login')}. "
                     f"Labels: {', '.join(l.get('name') for l in it.get('labels', []))}.\n{it.get('body') or ''}",
                     ["source:github", f"repo:{repo_full}", "kind:issue", f"owner:{user_key}"]))
    for pr in _rows(actions.execute_tool(tool_name="github_pull_requests_list", tool_input={"owner": owner, "repo": repo, "state": "all"},
                                         connection_name=conn, identifier=identifier).data):
        n = int(pr.get("number"))
        docs.append((_hdr("github", user_key, repo=repo_full, pr=f"#{n}") + f"\nGitHub pull request #{n} in {repo_full}: {pr.get('title')}\n"
                     f"State: {pr.get('state')}. Author: {(pr.get('user') or {}).get('login')}.\n{pr.get('body') or ''}",
                     ["source:github", f"repo:{repo_full}", "kind:pull_request", f"owner:{user_key}"]))
    f = actions.execute_tool(tool_name="github_file_contents_get", tool_input={"owner": owner, "repo": repo, "path": "README.md"},
                             connection_name=conn, identifier=identifier).data
    if isinstance(f, dict) and f.get("content"):
        text = base64.b64decode(f["content"]).decode("utf-8", "replace")
        docs.append((_hdr("github", user_key, repo=repo_full, file="README.md") + "\n" + text,
                     ["source:github", f"repo:{repo_full}", "kind:file", f"owner:{user_key}"]))
    return docs


def notion(actions, identifier, user_key, opt) -> list[Doc]:
    conn = opt["connection"]
    res = actions.execute_tool(tool_name="notion_page_search", tool_input={"query": opt.get("notion_query") or ""},
                               connection_name=conn, identifier=identifier).data
    docs: list[Doc] = []
    for pg in _rows(res)[:10]:
        pid = pg.get("id")
        title = "".join(t.get("plain_text", "") for t in ((pg.get("properties") or {}).get("title") or {}).get("title", [])) or pid
        md = actions.execute_tool(tool_name="notion_page_markdown_get", tool_input={"page_id": pid}, connection_name=conn, identifier=identifier).data
        text = md if isinstance(md, str) else (md.get("markdown") or md.get("content") or json.dumps(md))
        if not text.strip():
            continue
        docs.append((_hdr("notion", user_key, page=title) + f"\nNotion page: {title}\n{text[:MAX_DOC_CHARS]}",
                     ["source:notion", f"page:{title[:40]}", f"owner:{user_key}"]))
    return docs


def gmail(actions, identifier, user_key, opt) -> list[Doc]:
    res = actions.execute_tool(tool_name="gmail_fetch_mails", tool_input={"max_results": opt.get("limit", 30), **({"query": opt["gmail_query"]} if opt.get("gmail_query") else {})},
                               connection_name=opt["connection"], identifier=identifier).data
    lines = []
    for m in _rows(res):
        lines.append(f"[gmail · from {m.get('from') or m.get('sender')} · {m.get('date')}] {m.get('subject')}: {(m.get('snippet') or m.get('body') or '')[:800]}")
    return [(_hdr("gmail", user_key, mailbox=identifier) + "\nRecent email:\n" + "\n".join(lines), ["source:gmail", f"owner:{user_key}"])] if lines else []


def googlecalendar(actions, identifier, user_key, opt) -> list[Doc]:
    res = actions.execute_tool(tool_name="googlecalendar_list_events", tool_input={"max_results": opt.get("limit", 50)},
                               connection_name=opt["connection"], identifier=identifier).data
    lines = [f"[calendar · {(e.get('start') or {}).get('dateTime') or (e.get('start') or {}).get('date')}] {e.get('summary')} — {e.get('description') or ''} (attendees: {', '.join(a.get('email','') for a in e.get('attendees', []))})"
             for e in _rows(res)]
    return [(_hdr("googlecalendar", user_key, calendar=identifier) + "\nUpcoming events:\n" + "\n".join(lines), ["source:googlecalendar", f"owner:{user_key}"])] if lines else []


KNOWN: dict[str, Adapter] = {"slack": slack, "github": github, "githubpat": github, "github-connect": github, "notion": notion,
                             "gmail": gmail, "googlecalendar": googlecalendar}


# ---------------------------------------------------------------- generic adapter

def _is_read_only(tool) -> bool:
    d = tool.definition if isinstance(tool.definition, dict) else {}
    ann = d.get("annotations") or {}
    name = d.get("name", "")
    if ann.get("destructiveHint") or ann.get("destructive"):
        return False
    if ann.get("readOnlyHint") is True or ann.get("read_only") is True:
        return True
    return any(k in name for k in ("_list", "_search", "_fetch", "_get_all", "_recent"))


def _no_required_args(tool) -> bool:
    d = tool.definition if isinstance(tool.definition, dict) else {}
    schema = d.get("input_schema") or {}
    req = [r for r in (schema.get("required") or []) if not ((schema.get("properties") or {}).get(r, {}).get("display_properties") or {}).get("hidden")]
    return not req


def generic_plan(actions, connection: str, identifier: str) -> list[str]:
    tools, tok = [], None
    while True:
        r = actions.list_tools(connection_name=connection, identifier=identifier, page_size=200, page_token=tok)
        tools += list(r.tools)
        tok = getattr(r, "next_page_token", None)
        if not tok:
            break
    picked = [t.definition.get("name") for t in tools if _is_read_only(t) and _no_required_args(t)]
    return sorted(picked, key=_value, reverse=True)[:GENERIC_MAX_TOOLS]


# Records a company brain wants, roughly in order; noise a generic pull should skip.
_VALUABLE = ("issue", "ticket", "message", "mail", "thread", "conversation", "page", "doc", "file", "event", "meeting",
             "contact", "deal", "opportunit", "account", "task", "project", "record", "note", "incident", "customer", "search")
_NOISE = ("invite", "emoji", "gitignore", "gist", "reminder", "reaction", "usergroup", "starred", "template", "upload",
          "license", "notification", "scheduled", "view_list", "webhook", "label", "milestone", "key", "token")


def _value(name: str) -> int:
    score = sum(3 for k in _VALUABLE if k in name) - sum(4 for k in _NOISE if k in name)
    return score


def generic(actions, identifier, user_key, opt) -> list[Doc]:
    conn = opt["connection"]
    source = opt.get("provider") or conn
    docs: list[Doc] = []
    for tool_name in generic_plan(actions, conn, identifier):
        try:
            data = actions.execute_tool(tool_name=tool_name, tool_input={}, connection_name=conn, identifier=identifier).data
        except Exception as e:
            print(f"[mnemosyne] {conn}.{tool_name} failed: {str(e).splitlines()[0][:100]}")
            continue
        text = json.dumps(data, indent=1, default=str)[:MAX_DOC_CHARS]
        docs.append((_hdr(source, user_key, tool=tool_name) + f"\nRecords from {source} via {tool_name}:\n{text}",
                     [f"source:{source}", f"tool:{tool_name}", f"owner:{user_key}"]))
    return docs


# ---------------------------------------------------------------- discovery

def discover(actions, identifier: str) -> list[dict]:
    """Every system of record this user has connected, with status. This, not a config
    file, defines what goes into their brain."""
    out = []
    for acc in getattr(actions.list_connected_accounts(), "connected_accounts", []):
        if getattr(acc, "identifier", None) != identifier:
            continue
        conn = getattr(acc, "connector", None)
        out.append({"connection": conn, "provider": getattr(acc, "provider", None), "status": getattr(acc, "status", None),
                    "adapter": "known" if conn in KNOWN else "generic"})
    return out


def pull_all(actions, identifier: str, user_key: str, options: dict) -> tuple[list[Doc], list[dict]]:
    docs: list[Doc] = []
    manifest = []
    for sys_ in discover(actions, identifier):
        if sys_["status"] != "ACTIVE":
            manifest.append({**sys_, "documents": 0, "note": "not authorised"})
            continue
        opt = {**options, "connection": sys_["connection"], "provider": sys_["provider"]}
        adapter = KNOWN.get(sys_["connection"], generic)
        try:
            got = adapter(actions, identifier, user_key, opt)
        except Exception as e:
            print(f"[mnemosyne] {sys_['connection']} pull failed: {str(e).splitlines()[0][:140]}")
            got = []
        docs += got
        manifest.append({**sys_, "documents": len(got)})
    return docs, manifest
