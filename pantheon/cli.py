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

    a = sub.add_parser("ask", help="Hermes -> Cerberus -> Athena (-> Hephaestus)")
    a.add_argument("--user", choices=list(config.USERS), required=True)
    a.add_argument("question")
    a.add_argument("--execute", action="store_true", help="really execute actions via Scalekit (default dry-run)")

    g = sub.add_parser("grant", help="Cerberus: owner shares their dataset with another user")
    g.add_argument("--owner", choices=list(config.USERS), required=True)
    g.add_argument("--to", choices=list(config.USERS), required=True)

    e = sub.add_parser("eval", help="Themis: run scenarios, score, write evals/results-<label>.json")
    e.add_argument("--label", required=True)
    e.add_argument("--no-judge", action="store_true")
    e.add_argument("--only-user", choices=list(config.USERS))
    e.add_argument("--stage", choices=["isolated", "after-grant"], default="isolated")

    rs = sub.add_parser("rescore", help="Themis: re-score stored answers with the current scorer")
    rs.add_argument("--label", required=True)

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

    m = sub.add_parser("improve", help="Morpheus: run Cognee's improve() on a user's dataset")
    m.add_argument("--user", choices=list(config.USERS), required=True)

    args = p.parse_args()
    asyncio.run(_run(args))


async def _run(args) -> None:
    if args.cmd == "ingest":
        from . import mnemosyne

        for u in args.user or list(config.USERS):
            r = await mnemosyne.ingest(u, args.live, args.channel or [], args.github_repo, args.notion_query)
            print(json.dumps({"user": u, **r}))
    elif args.cmd == "ask":
        from . import hermes

        r = await hermes.ask(args.user, args.question, dry_run=not args.execute)
        for line in r["feed"]:
            print("  ·", line)
        print("\n" + r["answer"])
        if r["action"]:
            print("\naction:", json.dumps(r["action"], indent=2))
        print(f"\nsources={r['sources']} hidden={r['hidden']} latency={r['latency_s']}s")
    elif args.cmd == "grant":
        from . import cerberus

        print(await cerberus.grant(args.owner, args.to))
    elif args.cmd == "eval":
        from . import themis

        await themis.run(args.label, use_judge=not args.no_judge, only_user=args.only_user, stage=args.stage)
    elif args.cmd == "rescore":
        from . import themis

        themis.rescore(args.label)
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
    elif args.cmd == "improve":
        import cognee
        from .cerberus import get_or_create_user

        user = await get_or_create_user(args.user)
        r = await cognee.improve(config.dataset_for(args.user), user=user)
        print("improved:", str(r)[:300])


if __name__ == "__main__":
    main()
