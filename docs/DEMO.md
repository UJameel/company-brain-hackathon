# Pantheon — the demo, step by step

> **Names on screen:** the engineering lead is **David** (key `alice`), the contractor is **Goliath** (key `bob`). Internals keep `alice`/`bob`.

## 0. Ten minutes before (terminal, in the repo)
```bash
python -m pantheon warm                         # loads nimble:9b, ~15s. Redo if >5 min pass before you demo.
python -m pantheon actions --decline-all        # no stale proposals
python -m pantheon revoke --owner alice --to bob    # start isolated ("not found" error = already revoked, fine)
python -m pantheon grants                       # must print nothing
tmux ls                                         # pantheon-api and pantheon-web must both be listed
```
Browser tabs, left to right:
1. `https://company-brain-hackathon.vercel.app` (landing, scrolled to top)
2. `http://localhost:3000/app` signed in as **David** (left half of screen)
3. `http://localhost:3000/app` signed in as **Goliath** (right half of screen)
4. `https://github.com/UJameel/northwind-atlas/issues`
Font size up. Close everything else.

## 1. Landing page (60 seconds). Scroll slowly. Say the line when you see the heading.

**Hero: "The company brain that knows who is asking."**
"Every company brain you'll see today has one brain. Real companies have one brain per person, because people are allowed to know different things. Pantheon is a company brain that knows who it's talking to."

**"Every brain bot today reads your company with one token that sees everything."**
"That's the problem. One service token, one view, everyone sees everything. We did the opposite."

**"Seven agents. Seven regions of one brain."** *(scroll slowly, the brain turns to each region)*
"It's called Pantheon because it isn't one agent. It's seven Greek gods, each doing the job of one part of your brain.
Hermes, the messenger, is the thalamus: he routes every request.
Cerberus, the guard dog, is the amygdala: he decides what you may see.
Mnemosyne, memory, is the hippocampus: she pulls your tools and remembers.
Athena, wisdom, is the prefrontal cortex: she reasons and answers.
Hephaestus, the craftsman, is the motor cortex: he acts, only when you say yes.
Themis, justice, judges outcomes: she runs the evals.
Morpheus is sleep: he consolidates overnight."

**"Isolation, then a grant, then the answer changes."**
"This is the whole demo in one picture. Two people, same question, different answers. Then a share, and the gap closes. Let me show you it live."

**"Three layers, each doing one job."**
"Scalekit is the hands: every pull and every action runs as the person, with their own tokens. Cognee is the memory: one dataset per person, tagged with where everything came from. Respan is the proof: every call through the gateway, every run traced, every eval scored."

**"Scored before and after, by a judge that is not the agent."** *(point at the three numbers)*
"Isolation 0.99, zero leaks. Coverage 0.89 before the share, 1.00 after."

Skip the quickstart. Click **Open the app**, then switch to tab 2.

## 2. Live demo (2 minutes 30). The seeded company is Northwind Labs, launching a product called Atlas.

### Beat 1: Connections (15s) — tab 2, David
Click **Connections** in the left rail.
Say: "David runs engineering. He connected Slack, GitHub and Notion. Mnemosyne pulled each one as David, through Scalekit, with his tokens. No bot anywhere."
Point at tab 3's header: "Goliath is a contractor. Slack only."
Click **Chat**.

### Beat 2: Cross-source answer (30s) — tab 2, David
Click the chip **What's blocking PR #3?**
While the rail lights up, say: "Hermes understood a question. Cerberus scoped it to David's brain. Athena found passages across GitHub, Slack and Notion."
The answer will say, in some wording:
- PR #3 (the Paddle billing migration) is blocked by **issue #1**, the **Paddle webhook retry storm**
- **Marco** owns both
- the fix is **exponential backoff and idempotency keys**
- sources: GitHub PR #3, GitHub issue #1, Slack #engineering (and possibly the Notion launch plan)
Point at the source chips: "Three systems, each fact cited."
Point at the suggestion card: "And Hephaestus already suggests the follow-up: a Slack message to Marco. We'll come back to actions."

### Beat 3: Access (50s) — tab 3, Goliath
Click the chip **What will Pro cost after launch?**
The answer will say: **$49** on the pricing page for now, leadership will confirm pricing closer to launch, and **"There is information in David's brain you do not have access to; ask David."**
A card appears: **1 dataset you can't see — David's brain**, with a **Grant** button.
Say: "Same brain. Goliath gets $49. And Cerberus tells him there's a brain he can't see, and who owns it. It knows what it doesn't know, for this person."

Click **Grant** (on Goliath's card, or in David's window).
Say: "David shares. That's a real Cognee permission, not a prompt."

Click the chip **What will Pro cost after launch?** again.
The answer will now say: **$59 per month, effective launch day, October 21** (Slack #leadership, Notion launch plan).
Say: "Now $59, from the leadership channel. Same brain, same question, different answer, because access changed."

### Beat 4: Action (30s) — tab 2, David
Click the chip **Open an issue for the $59 price**.
A card appears: **Pantheon wants to open a GitHub issue**, title like "Switch pricing page to $59 on launch day", with Approve / Decline / Revise.
Say: "Hephaestus wants to open a GitHub issue. Nothing happens until I say yes."
Type **yes** in the composer and press Enter (or click **Approve and open it**).
The card shows **Open on GitHub**.
Switch to tab 4, refresh. The new issue is at the top, author UJameel, footer "Opened by Pantheon (Hephaestus) on behalf of the requesting user via Scalekit".
Say: "Done, as David, through Scalekit. I could have typed no, or make it shorter. Pantheon remembers what I decide."
Back to tab 2.

### Beat 5: Proof (20s) — tab 2
Click David's avatar top right, then **Quality**.
Say: "Themis ran fifteen questions plus two prompt-injection attacks, judged by a separate model, every run traced in Respan. Zero leaks. Coverage 0.89 before the share, 1.00 after. The grant was the change, and the eval saw it."

### Close (10s)
"Seven gods. One brain per person. It knows your company, and only tells you what you may know."

## 3. If asked
- **What's novel?** "Authorization is an agent, not a filter. Scalekit decides what you can pull, Cognee what you can recall, Cerberus tells you what you're missing."
- **Slack?** "Slack proposals are dry runs because the demo workspace isn't the fictional company's. GitHub is real; you just saw it."
- **Local model?** "Routing and judging run on nimble, a 9B decision model on this laptop. Only the writing goes to the cloud."
- **Prompt injection?** "Every passage is data. A forwarded email in the seed tells the AI to leak pricing. Athena quotes it, ignores it, flags it, and no action targets the attacker." (If you want to show it: ask David *"What did the Paddle partner rep email us?"*)
- **Other seeded facts if a judge asks something:** launch **October 21**, **Priya** owns the announcement; **code freeze and staging deploy freeze October 18**; launch slips to **October 28** if PR #3 isn't merged by **October 15**; **hiring freeze** through Q4 (leadership only); office closed **October 13**; Goliath owns **issue #2**, the pricing page.
- **Why David and Goliath?** "Another team took Alice and Bob."

## 4. If something breaks
- Answer slow (15s+): nimble reloaded. It still answers. Keep talking.
- Grant didn't change Goliath's answer: ask once more; if still $49, run `python -m pantheon grants` in the terminal.
- "Could not do it" on the action card: read the error aloud, show issue #5 on GitHub as the earlier proof, move on.
- API down: the app switches to recorded mode by itself; the same four questions replay for both users, including the grant. Say so and continue.
