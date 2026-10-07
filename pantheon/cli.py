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

    c = sub.add_parser("compare", help="Themis: before/after table")
    c.add_argument("before")
    c.add_argument("after")

    m = sub.add_parser("improve", help="Morpheus: run Cognee's improve() on a user's dataset")
    m.add_argument("--user", choices=list(config.USERS), required=True)

    args = p.parse_args()
    asyncio.run(_run(args))


async def _run(args) -> None:
    if args.cmd == "ingest":
        from . import mnemosyne

        for u in args.user or list(config.USERS):
            r = await mnemosyne.ingest(u, args.live, args.channel or ["#general", "#engineering", "#leadership"], args.github_repo)
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

        await themis.run(args.label, use_judge=not args.no_judge, only_user=args.only_user)
    elif args.cmd == "compare":
        from . import themis

        print(themis.compare(args.before, args.after))
    elif args.cmd == "improve":
        import cognee
        from .cerberus import get_or_create_user

        user = await get_or_create_user(args.user)
        r = await cognee.improve(config.dataset_for(args.user), user=user)
        print("improved:", str(r)[:300])


if __name__ == "__main__":
    main()
