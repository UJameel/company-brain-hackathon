"""pantheon CLI: ingest | ask | grant | eval | compare | improve | demo"""
from __future__ import annotations

import argparse
import asyncio
import json

from . import config


def main() -> None:
    p = argparse.ArgumentParser(prog="pantheon", description=__doc__)
    sub = p.add_subparsers(dest="cmd", required=True)

    i = sub.add_parser("ingest", help="Mnemosyne: pull as each user and remember into their dataset")
    i.add_argument("--user", choices=list(config.USERS), action="append")
    i.add_argument("--live", action="store_true", help="pull through Scalekit (default: replay sample_data/)")
    i.add_argument("--channel", action="append", default=None)
    i.add_argument("--github-repo", default=None)
    i.add_argument("--notion-query", default=None, help="Notion search query to pull pages for (live only)")
    i.add_argument("--all", action="store_true", help="pull EVERY system the user has connected through Scalekit (live only)")

    so = sub.add_parser("sources", help="Mnemosyne: list the systems of record a user has connected, and what a generic pull would call")
    so.add_argument("--user", choices=list(config.USERS), default="alice")
    so.add_argument("--plan", action="store_true", help="show the read-only tools the generic adapter would call per connection")

    a = sub.add_parser("ask", help="Hermes -> Cerberus -> Athena (-> Hephaestus)")
    a.add_argument("--user", choices=list(config.USERS), required=True)
    a.add_argument("question")
    a.add_argument("--execute", action="store_true", help="really execute actions via Scalekit (default dry-run)")

    g = sub.add_parser("grant", help="Cerberus: owner shares their dataset with another user")
    g.add_argument("--owner", choices=list(config.USERS), required=True)
    g.add_argument("--to", choices=list(config.USERS), required=True)

    gr = sub.add_parser("grants", help="Cerberus: live shares, read from Cognee")

    rv = sub.add_parser("revoke", help="Cerberus: owner revokes a share")
    rv.add_argument("--owner", choices=list(config.USERS), required=True)
    rv.add_argument("--to", choices=list(config.USERS), required=True)

    e = sub.add_parser("eval", help="Themis: run scenarios, score, write evals/results-<label>.json")
    e.add_argument("--label", required=True)
    e.add_argument("--no-judge", action="store_true")
    e.add_argument("--only-user", choices=list(config.USERS))
    e.add_argument("--stage", choices=["isolated", "after-grant"], default="isolated")

    rs = sub.add_parser("rescore", help="Themis: re-score stored answers with the current scorer")
    rs.add_argument("--label", required=True)
    rs.add_argument("--stage", choices=["isolated", "after-grant"], default=None, help="score against these expectations")
    rs.add_argument("--as", dest="as_label", default=None, help="write to results-<as>.json instead")

    c = sub.add_parser("compare", help="Themis: before/after table")
    c.add_argument("before")
    c.add_argument("after")

    z = sub.add_parser("authorize", help="Print the Scalekit consent link for a user and connection")
    z.add_argument("--user", choices=list(config.USERS), required=True)
    z.add_argument("--connection", default=None, help="connection name (default: slack and github)")

    s_ = sub.add_parser("seed", help="Post the Northwind transcripts into the real Slack workspace, as Alice")
    s_.add_argument("--channel", action="append", default=None)

    t_ = sub.add_parser("tools", help="List the tools a user's connected account can call")
    t_.add_argument("--connection", required=True)
    t_.add_argument("--user", choices=list(config.USERS), default="alice")

    v = sub.add_parser("mcp", help="Scalekit Virtual MCP server: ensure it exists and mint a session token for a user")
    v.add_argument("--user", choices=list(config.USERS), default="alice")

    ac = sub.add_parser("actions", help="Hephaestus: list proposed actions awaiting a decision")
    ac.add_argument("--user", choices=list(config.USERS), default=None)

    dc = sub.add_parser("decide", help="Hephaestus: approve / decline / revise a proposed action")
    dc.add_argument("action_id")
    dc.add_argument("decision", choices=["approve", "decline", "revise"])
    dc.add_argument("--note", default=None, help="why, or how to change it (revise)")
    dc.add_argument("--execute", action="store_true", help="approve for real through Scalekit (default dry-run)")

    m = sub.add_parser("improve", help="Morpheus: run Cognee's improve() on a user's dataset")
    m.add_argument("--user", choices=list(config.USERS), required=True)

    args = p.parse_args()
    asyncio.run(_run(args))


async def _run(args) -> None:
    if args.cmd == "ingest":
        from . import mnemosyne

        for u in args.user or list(config.USERS):
            r = await mnemosyne.ingest(u, args.live, args.channel or [], args.github_repo, args.notion_query, all_sources=args.all)
            print(json.dumps({"user": u, **r}))
    elif args.cmd == "sources":
        from . import mnemosyne, sources

        systems = mnemosyne.discover(args.user)
        for s_ in systems:
            line = f"{s_['connection']:<18} {s_['status']:<8} {s_['adapter']}"
            if args.plan and s_["adapter"] == "generic" and s_["status"] == "ACTIVE":
                line += "  -> " + ", ".join(sources.generic_plan(mnemosyne._actions(), s_["connection"], config.USERS[args.user]))
            print(line)
        if not systems:
            print(f"{args.user} has not connected any system yet. Run: python -m pantheon authorize --user {args.user}")
    elif args.cmd == "ask":
        from . import hermes

        r = await hermes.ask(args.user, args.question, dry_run=not args.execute)
        for line in r["feed"]:
            print("  ·", line)
        print("\n" + r["answer"])
        if r["action"]:
            print("\naction:", json.dumps(r["action"], indent=2))
        for s_ in r.get("suggested_actions", []):
            print(f"\nHephaestus proposes [{s_['id']}] {s_['tool']}: {s_['rationale']}\n   {json.dumps(s_['input'])}\n   -> python -m pantheon decide {s_['id']} approve|decline|revise --note '...'")
        print(f"\nsources={r['sources']} hidden={r['hidden']} latency={r['latency_s']}s")
    elif args.cmd == "grant":
        from . import cerberus

        print(await cerberus.grant(args.owner, args.to))
    elif args.cmd == "grants":
        from . import cerberus

        for g in await cerberus.grants():
            print(f"{g['owner']} -> {g['grantee']}  {g['dataset']}  ({g['permission']})")
    elif args.cmd == "revoke":
        from . import cerberus

        print(await cerberus.revoke(args.owner, args.to))
    elif args.cmd == "eval":
        from . import themis

        await themis.run(args.label, use_judge=not args.no_judge, only_user=args.only_user, stage=args.stage)
    elif args.cmd == "rescore":
        from . import themis

        themis.rescore(args.label, stage=args.stage, as_label=args.as_label)
    elif args.cmd == "compare":
        from . import themis

        print(themis.compare(args.before, args.after))
    elif args.cmd == "authorize":
        from .mnemosyne import _actions, ensure_authorized

        actions = _actions()
        for conn in ([args.connection] if args.connection else [config.SLACK_CONNECTION, config.GITHUB_CONNECTION, config.NOTION_CONNECTION]):
            ok = ensure_authorized(actions, conn, config.USERS[args.user])
            print(f"{args.user} / {conn}: {'ACTIVE' if ok else 'needs authorization (link above)'}")
    elif args.cmd == "seed":
        from .seed import seed_slack

        print(seed_slack("alice", args.channel))
    elif args.cmd == "tools":
        from .mnemosyne import _actions

        res = _actions().list_tools(connection_name=args.connection, identifier=config.USERS[args.user], page_size=100)
        for t in getattr(res, "tools", []):
            print(getattr(t, "name", t))
    elif args.cmd == "mcp":
        from .mcp import session_token

        r = session_token(args.user)
        print(json.dumps({k: (v[:12] + "…" if k == "token" and v else v) for k, v in r.items()}, indent=2))
        print("\nClaude Code: claude mcp add --transport http pantheon", r["mcp_server_url"], "--header", '"Authorization: Bearer <token>"')
    elif args.cmd == "actions":
        from . import hephaestus

        for p_ in hephaestus.pending(args.user):
            print(f"[{p_['id']}] {p_['user']:<6} {p_['tool']:<22} {p_['origin']:<10} {json.dumps(p_['input'])[:110]}")
    elif args.cmd == "decide":
        from . import hephaestus

        print(json.dumps(await hephaestus.decide(args.action_id, args.decision, args.note, dry_run=not args.execute), indent=2, default=str)[:1500])
    elif args.cmd == "improve":
        import cognee
        from .cerberus import get_or_create_user

        user = await get_or_create_user(args.user)
        r = await cognee.improve(config.dataset_for(args.user), user=user)
        print("improved:", str(r)[:300])


if __name__ == "__main__":
    main()
