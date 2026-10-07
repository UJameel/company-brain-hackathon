# Pantheon — 3-minute demo script

Setup before walking up: terminal with `.venv` active in the repo, Respan Logs tab open (LIVE), GitHub northwind-atlas issues tab open, Scalekit Connected Accounts tab open. Font size up.

**0:00 — Problem (20s)**
"Every company-brain demo you'll see today has one brain. Real companies have one brain per employee, because people are allowed to know different things. Pantheon is a company brain that knows who it's talking to. Northwind Labs, launching Atlas. Alice is the eng lead. Bob is a contractor."

**0:20 — Pull (25s)**
Scalekit tab: three connections, Alice's connected accounts ACTIVE. Terminal:
```
python -m pantheon ingest --user alice --live --github-repo UJameel/northwind-atlas --notion-query "Atlas Launch Plan"
```
"Mnemosyne pulls GitHub and Notion *as Alice*, through Scalekit, no bot token. Slack is a recorded pull. Everything lands in Alice's Cognee dataset tagged by source."

**0:45 — Brain (35s)**
```
python -m pantheon ask --user alice "What is blocking PR #3, who owns it, and which issue tracks the blocker?"
```
Point at the activity feed: Hermes routed on gpt-4o-mini, Cerberus scoped, Athena answered on Sonnet. Answer cites Slack #engineering + GitHub PR #3 + issue #1. "Facts from two apps, each cited."
Respan tab: the `pantheon.ask` workflow with a task per agent, model and tokens per step.

**1:20 — Access (50s)**
```
python -m pantheon ask --user bob "What will the Pro plan cost after the Atlas launch?"
```
"Bob gets $49 and is told: there is information in alice-brain, channel:leadership and GitHub, that you can't read; ask Alice. The brain knows what it doesn't know *for this user*."
```
python -m pantheon grant --owner alice --to bob
python -m pantheon ask --user bob "What will the Pro plan cost after the Atlas launch?"
```
"Same brain, same question, now $59 from #leadership. That's Cognee dataset permissions, and Scalekit decided what each user could pull in the first place."

**2:10 — Act (20s)**
```
python -m pantheon ask --user alice "Open a GitHub issue asking Marco to add exponential backoff to the Paddle webhook handler so PR #3 can merge." --execute
```
GitHub tab: refresh, the issue is there, opened under Alice's account. "Hephaestus acts as the user through Scalekit. Never a shared token."

**2:30 — Eval (20s)**
```
python -m pantheon compare before-coverage after
```
"Fifteen scenarios, independent judge on a different model, every run traced. Isolation run: no leaks. Isolation run 0.99 with zero leaks. Coverage before the share 0.89, after 1.00. The grant is the change, and the eval saw it."

**2:50 — Close (10s)**
"Seven agents, named after brain regions, so the architecture reads in one glance. This is what it looks like when a company has a brain, and the brain knows who it's talking to."

## If something breaks
- Live pull fails: `python -m pantheon ingest` (recorded) and say so.
- Scalekit action fails: drop `--execute`, show the dry-run payload with `as_user`.
- Respan tab empty: show `evals/results-after.json` rows with `usage` per step.
