# Pantheon — 3-minute live demo

> **Names on screen:** the engineering lead appears as **David** and the contractor as **Goliath** in the app and the demo (another team at the event used Alice and Bob). Internally the user keys, datasets (`alice-brain`, `bob-brain`), sample data and scenarios keep `alice`/`bob`.


## Before walking up (2 minutes)
```bash
cd ~/company-brain-hackathon
python -m pantheon warm                       # load nimble:9b (~15s); Ollama unloads it after 5 idle minutes
python -m pantheon actions --decline-all      # no stale proposals
python -m pantheon revoke --owner alice --to bob   # start isolated (ignore the error if already revoked)
tmux ls                                       # pantheon-api (:8080) and pantheon-web (:3000) must be running
```
Open two browser windows side by side at http://localhost:3000/app. Sign in as **David** (the engineering lead, key alice) in the left window and **Goliath** (the contractor, key bob) in the right. Have the GitHub repo issues page (UJameel/northwind-atlas) in a third tab. Font size up.

## The script

**0:00 — Problem (20s)**
"Every company-brain demo you'll see today has one brain. Real companies have one brain per employee, because people are allowed to know different things. Pantheon is a company brain that knows who it's talking to. Northwind Labs is launching Atlas. David is the eng lead. Goliath is a contractor."

**0:20 — Pull (15s)**
David's window, Connections page: "David connected Slack, GitHub and Notion. Mnemosyne pulled each one *as David*, through Scalekit. No bot token. Goliath connected only Slack." Point at Goliath's header: Slack only.

**0:35 — Brain (35s)**
David's window, Chat: click **What's blocking PR #3?**
Read the rail aloud as it lights: "Hermes understood a question, Cerberus scoped it to David's brain, Athena found passages across GitHub, Slack and Notion." Answer cites all three. "Facts from three systems, each cited. And the brain already suggests the follow-up."

**1:10 — Access (50s)**
Goliath's window: click **What will Pro cost after launch?**
"Goliath gets $49 and is told: there is a dataset you can't see, owned by David. The brain knows what it doesn't know, for *this* person." Point at the hidden card.
David's window (or the Grant button on Bob's card): **Grant**.
Goliath's window: click the same question again. "Same brain, same question, now $59 from #leadership. Cognee dataset permissions did that, and Scalekit decided what each of them could pull in the first place."

**2:00 — Act (30s)**
David's window: click **Open an issue for Marco**. A "Pantheon wants to" card appears with the drafted issue.
Type **yes** (or click Approve and open it). Switch to the GitHub tab, refresh: the issue is there, under David's account. "Hephaestus acts as the user, through Scalekit. Nothing runs until a human says yes, and you can say it in plain words: yes, no, make it shorter."

**2:30 — Eval (20s)**
User menu, **Quality**: "Fifteen scenarios plus two planted prompt-injection attacks. Independent judge on a different model, every run traced in Respan. Isolation run 0.99, zero leaks. Coverage before the share 0.89, after 1.00. The grant is the change, and the eval saw it."

**2:50 — Close (10s)**
"Seven agents named after brain regions, so the architecture reads in one glance. One brain per person. It knows your company, and only tells you what you may know."

## If something breaks
- API down: the app falls back to recorded mode automatically (header shows it); the same four questions replay for both users, including the grant beat. Say so.
- Slow first answer: nimble was unloaded; the route falls back to the gateway by itself, nothing to do.
- Grant did not change Bob's answer: check `python -m pantheon grants`; re-ask once (recall is live, not cached).
- GitHub tab shows no new issue: the card shows the Scalekit result inline; read the issue number from there.
