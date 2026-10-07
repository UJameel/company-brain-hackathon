# Pantheon — a Company Brain run by named agents

> Scalekit × Cognee × Respan "Build a Company Brain" hackathon, SF Tech Week, 2026-10-07. Solo entry by Usman Jameel.

Pantheon is a company brain for a fictional 40-person SaaS company, **Northwind Labs**. It pulls knowledge from Slack and GitHub *as each employee* (Scalekit), remembers it in a per-user knowledge graph (Cognee), answers cross-source questions with provenance, acts in the user's tools as them, and proves it works with an independent, traced evaluation (Respan).

The twist: **every employee gets their own view of the brain.** Alice (eng lead) and Bob (contractor) ask the same question and get different, correct answers, because their Scalekit connections and their Cognee datasets differ. The brain tells Bob what exists that he cannot see and who to ask. Then Alice grants access live, and Bob's answer changes. The eval shows the before and after.

## The agents (brain region → job)

| Agent | Brain region | Job | Layer |
|---|---|---|---|
| **Hermes** | thalamus | routes the request; picks the model per step through the Respan gateway; traces the run | Respan |
| **Cerberus** | amygdala | authorization gate: Scalekit `identifier` == Cognee user; scopes recall to readable datasets; reports what is hidden; performs grants | Scalekit + Cognee |
| **Mnemosyne** | hippocampus | pulls as each user via Scalekit; `remember()`s into that user's dataset with `node_set` provenance; records every pull to `sample_data/` | Scalekit → Cognee |
| **Athena** | prefrontal cortex | `recall()`s scoped passages; synthesises a cited answer; says what it cannot see | Cognee + Respan |
| **Hephaestus** | motor cortex | acts as the user through Scalekit (`slack_send_message`, `githubpat_issue_create`); allow-listed, never destructive | Scalekit |
| **Themis** | orbitofrontal cortex | independent scorer: deterministic fact check + pinned LLM judge; before/after | Respan |
| **Morpheus** | sleep | consolidation: Cognee `improve()` | Cognee |

```text
[ Scalekit connections, per user ]  --execute_tool(identifier=alice)-->  Mnemosyne
        |                                                                   |
        |            remember(dataset="alice-brain", user=alice, node_set=[source:slack, channel:general, owner:alice])
        v                                                                   v
[ Cognee, ENABLE_BACKEND_ACCESS_CONTROL=true ]  <--recall(datasets=readable, user=bob)--  Cerberus -> Athena
        |                                                                   |
        v                                                                   v
[ Respan: gateway (all LLM calls), traces (pantheon.ask workflow), evals (Themis) ]   Hephaestus -> Scalekit write, as the user
```

## Quickstart (judges)

```bash
git clone https://github.com/UJameel/company-brain-hackathon && cd company-brain-hackathon
uv venv --python 3.12 .venv && source .venv/bin/activate
uv pip install cognee scalekit-sdk-python openai python-dotenv respan-ai pytest
cp .env.example .env          # fill RESPAN_API_KEY; Scalekit vars only needed for --live
mkdir -p .cognee_system .data_storage

# 1. Remember: replay the recorded pulls (no SaaS accounts needed)
python -m pantheon ingest

# 2. Ask as two users
python -m pantheon ask --user alice "What is blocking PR #42 and who owns it?"
python -m pantheon ask --user bob   "What is blocking PR #42 and who owns it?"

# 3. Evaluate (before), grant, evaluate (after)
python -m pantheon eval --label before
python -m pantheon grant --owner alice --to bob
python -m pantheon eval --label after
python -m pantheon compare before after
```

Live mode (your own Scalekit workspace, connections named `slack` and `githubpat`):

```bash
python -m pantheon ingest --live --github-repo <owner>/<repo>
python -m pantheon ask --user alice "Who owns the launch announcement? Draft them a Slack message." --execute
```

## Access story

| | Alice (eng lead) | Bob (contractor) |
|---|---|---|
| Scalekit connections | Slack, GitHub (PAT) | Slack only |
| Slack membership | #general, #engineering, **#leadership (private)** | #general, #engineering |
| Cognee dataset | `alice-brain` (owner) | `bob-brain` (owner) |
| Before grant | sees everything | public channels only; brain says what is hidden and who owns it |
| Grant | `pantheon grant --owner alice --to bob` → Cognee `authorized_give_permission_on_datasets(read)` | |
| After grant | unchanged | cross-source answers now grounded in GitHub too |

## Evaluation

`evals/scenarios.json`: 15 scenarios, 9 as Alice and 6 as Bob, with `must_mention`, `must_not_mention`, `expected_sources` (Cognee `node_set` tags) and `expected_action`. Four of Bob's scenarios carry an `after_grant` block: once Alice shares her dataset, Bob is *supposed* to see more, so the expectation flips.

Themis scores each run 60% deterministic fact check + 40% LLM judge. The judge is `claude-haiku-4-5`, pinned, returning structured booleans; Athena answers with `claude-sonnet-4-5`, so the judge is independent. Results land in `evals/results-<label>.json`; `compare` prints the table; `rescore` re-scores stored answers so two runs are always judged by the same judge.

Three numbers, because a grant changes what *correct* means:

| run | brain state | expectations | what it proves |
|---|---|---|---|
| `before` | isolated | isolated (Bob must not see leadership facts) | **no leaks**: Bob refuses correctly |
| `before-coverage` | isolated | full knowledge | how much of the team's questions Bob's brain can answer before the share |
| `after` | Alice shared `alice-brain` with Bob | full knowledge | the difference closes |

## Memory design

- **Permanent graph:** one dataset per user, one document per Slack channel and per GitHub issue/PR/file, each tagged `source:*`, `channel:*`/`repo:*`, `owner:*`. The provenance header is also the first line of the text so retrieved chunks carry their source.
- **Session memory:** Hermes keeps the run's usage and activity feed per request; Cognee session memory is left at its default.
- **Improve:** `pantheon improve --user alice` runs Cognee's enrichment on the dataset.
- **Graph explorer:** `cognee-cli -ui`.

## Safety

No tokens in code or `.env.example`. All LLM calls go through the Respan gateway. Hephaestus only exposes two write tools and is dry-run by default. Cognee state is local to the repo and gitignored.
