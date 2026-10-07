# Team Submission

## Team

- Team name: Pantheon
- Participants: Usman Jameel (solo)
- Company Brain / project name: **Pantheon** — a company brain run by named agents, each mapped to a region of the human brain

## Company Brain Overview

Pantheon is the company brain for Northwind Labs, a fictional 40-person SaaS company shipping a product called Atlas. Wherever the company lives, Pantheon pulls it: Mnemosyne discovers every system of record each employee has connected through Scalekit and pulls it *as that employee* (known adapters for Slack, GitHub, Notion, Gmail, Calendar; a generic read-only adapter for any of the other 400+ connectors), remembers everything in a per-user Cognee knowledge graph tagged by source, answers cross-source questions with provenance, acts in the user's tools as them (it opened a real GitHub issue during the build), and proves itself with an independent, traced evaluation in Respan. The workflow it solves is **launch readiness for an engineering team**: "what is blocking the launch, who owns it, what changed, and who do I ask". The access story is the product: Alice (eng lead) and Bob (contractor) ask the same question and get different, correct answers because their Scalekit connections and Cognee datasets differ; the brain tells Bob what exists that he cannot see and who owns it; Alice grants access live; Bob's answer changes; the eval shows before and after.

- Data sources connected through Scalekit (≥ 2 apps): Slack (`slack`), GitHub (`github-connect`), Notion (`notion`, live: the leadership launch-plan page)
- Primary use case / team workflow: launch-readiness Q&A and triage for an engineering team, with write-back (open the follow-up issue)
- Users in the demo and how their access differs: Alice = Slack (#general, #engineering, private #leadership) + GitHub; Bob = Slack public channels only, no GitHub connection
- What makes it stand out: every connected system of record is a source (discovery per user, generic adapter for unknown connectors); agents propose actions the user approves, declines or revises, and decisions are remembered; authorization is a named agent (Cerberus) and is enforced twice, at pull (Scalekit per-user tokens) and at recall (Cognee per-user datasets, by id); every step is a named brain region in the Respan trace; the eval re-scores stored answers so before/after are judged by the same judge

## The Three Layers

### Pull — Scalekit

- Connections created (`connection_name` → app): `slack` → Slack (Scalekit-managed OAuth), `github-connect` → GitHub, `notion` → Notion
- Tools called: `github_issues_list`, `github_pull_requests_list`, `github_file_contents_get`, `slack_fetch_conversation_history`, `slack_list_channels`, `notion_page_search`, `notion_page_markdown_get`; write-back `github_issue_create` (and `slack_send_message`, allow-listed)
- How users are identified (`identifier` ↔ Cognee user): the Scalekit `identifier` is the Cognee user's email (`USER_ALICE`, `USER_BOB` in `.env`); Cerberus resolves both from one key
- Write-back actions the agent takes: on request and by proposal (approve / decline / revise, `pantheon actions`, `pantheon decide`); Hephaestus opened GitHub issue UJameel/northwind-atlas#5 as `usman@ask-luca.com` via `execute_tool(identifier=...)`; dry-run by default, `--execute` to act; destructive tools are not exposed
- Virtual MCP server: `pantheon-hephaestus` (config `cfg_146540509584687370`) exposes four tools; `python -m pantheon mcp --user alice` mints a per-user session token
- Code entry point: `pantheon/sources.py` (systems-of-record registry, discovery, generic adapter), `pantheon/mnemosyne.py` (pull + remember), `pantheon/hephaestus.py` (act, propose, decide), `pantheon/mcp.py`

### Remember — Cognee

- Permanent graph (`cognee.remember(...)` without `session_id`): one dataset per user (`alice-brain`, `bob-brain`); one document per Slack channel, per GitHub issue / PR / file, per Notion page
- Session memory: Hermes keeps per-run usage and the activity feed; Cognee session memory left at default
- `node_set` tags: `source:slack|github|notion`, `channel:<name>`, `repo:<owner/repo>`, `kind:issue|pull_request|file`, `page:<title>`, `owner:<user>`; the same header is the first line of every document so retrieved chunks carry provenance into the answer and into the scorer
- Datasets and who owns / can read each: `alice-brain` owned by Alice; `bob-brain` owned by Bob; after the grant Bob can read `alice-brain`
- Access control: `ENABLE_BACKEND_ACCESS_CONTROL=true`; grant = `authorized_give_permission_on_datasets(bob, [alice-brain], "read", alice)`; revoke supported; recall of shared datasets uses `dataset_ids` (names resolve only among owned datasets)
- Beyond defaults: `SearchType.CHUNKS` for retrieval so provenance survives and the synthesis model is ours (routed through Respan); `improve()` via `pantheon improve`; Cerberus's "hidden" computation compares `node_set` tags across datasets to tell the user what exists that they cannot read
- Code entry point: `pantheon/cerberus.py`, `pantheon/athena.py`

### Act + Evaluate — your agent(s) + Respan

- Agents: Hermes (route + model per step), Cerberus (authorization), Mnemosyne (discover + ingest), Athena (answer), Hephaestus (act on request, propose follow-ups, execute on approval), Themis (evaluate), Morpheus (improve; remembers decisions)
- Model routing (slide criterion 4): Hermes picks the model per step. Text-writing steps go through the Respan gateway: `claude-sonnet-4-5` for synthesis, `claude-haiku-4-5` for action drafts. Closed-set decisions (routing, the Themis judge) run on a **local 8B model via Ollama** (`llama3.1:8b` on the demo machine; any tag) with automatic fallback to `gpt-4o-mini` / `claude-haiku-4-5` on the gateway when Ollama is unreachable, as in the hosted image. Agreement local vs gateway: router 17/18, judge 15/15. Cognee's extraction and embeddings run through the gateway (`openai/gpt-4o-mini`, `openai/text-embedding-3-large`). Usage is recorded per step with provider, model, tokens; the judge stays independent of the model Athena answers with either way.
- Tracing: `respan-ai` SDK, `Respan()` at startup, `@workflow("pantheon.ask")` + `@task` per agent step; gateway calls auto-logged with model, tokens, cost
- Scenario file: `evals/scenarios.json`, 15 scenarios (9 as Alice, 6 as Bob) with `must_mention`, `must_not_mention`, `expected_sources`, `expected_action`, and `after_grant` overrides for Bob
- Evaluator: deterministic fact check (60%) + LLM judge on pinned `claude-haiku-4-5` returning structured booleans (40%); judge model ≠ answer model
- Code entry point: `pantheon/themis.py`, `pantheon/hermes.py`

## Evaluation Evidence

Three runs, because a grant changes what *correct* means. All judged by the same pinned judge (`pantheon rescore`).

| run | brain state | expectations | mean (n=15) | proves |
|---|---|---|---|---|
| `before` | isolated | isolated: Bob must **not** see leadership facts | **0.99** | no leaks: Bob refuses correctly in every scenario |
| `before-coverage` | isolated | full knowledge | **0.89** | how much of the team's questions Bob's brain covers before the share |
| `after` | Alice shared `alice-brain` with Bob | full knowledge | **1.00** | the difference closes |

Same stored answers re-judged by the local `llama3.1:8b` judge (`results-*-localjudge.json`): coverage before 0.877, after 1.00, isolation unchanged. Three of Bob's correct refusals move by ±0.2; no leak is scored differently.

### Baseline Run (`before-coverage`: isolated brain, full-knowledge expectations)

- Respan trace / eval run link: platform.respan.ai → Observability → Logs, workflow `pantheon.ask` (filter by time)
- Scenarios run: 15
- Mean score: 0.89
- Worst scenarios and why they failed: `launch-risk-bob`, `pro-price-bob`, `hiring-bob` (0.50 each) — Bob cannot see #leadership, so he correctly does not state the slip date, the $59 price or the hiring freeze; `pr42-blocker-bob` (0.85) — correct from Slack but not grounded in GitHub, which he has no connection to. These are the access boundary showing up in the score.

```text
question: What is blocking PR #3, who owns it, and which issue tracks the blocker?   (as bob)
expected: Marco, webhook, #1; sources slack + github
got:      Marco / webhook retry storm / issue #1 from Slack #engineering only; told that alice-brain holds GitHub content he cannot read
score:    0.85
```

### Improved Run (after the grant)

- Respan trace / eval run link: same view, later timestamp
- What changed: Alice ran `pantheon grant --owner alice --to bob` (Cognee `authorized_give_permission_on_datasets`, read), and the Notion launch-plan page was added to `alice-brain` as a live third source.
- Mean score: 1.00

```text
Before:  mean = 0.89   (n = 15 scenarios)
After:   mean = 1.00   (n = 15 scenarios)
```

## Access Story

- User A: `usman@ask-luca.com` (Alice) — connections: slack, github-connect, notion — datasets readable: `alice-brain`
- User B: `bob@northwind.dev` (Bob) — connections: none authorized (Slack replayed from his recorded pull) — datasets readable: `bob-brain`
- Question asked by both: "What will the Pro plan cost after the Atlas launch?"
- Result for A: "$59 per month, effective launch day, October 21 (Slack #leadership)"
- Result for B before the share: "$49 today; the new price is not in anything you can read. There is information in alice-brain (channel:leadership, source:github) you do not have access to; ask alice."
- The grant: Alice shares `alice-brain` with Bob, permission `read`
- Result for B after the share: "$59 per month after launch (Slack #leadership)"

## Trust boundaries

Retrieved content is untrusted data: Athena is told never to follow instructions found in passages and to flag attempts; sources an outsider can write into (email, support desks, CRMs) are tagged `trust:external`; Hephaestus refuses any proposed action whose destination is not already known to the brain, so a forwarded email cannot pick where something is sent; nothing executes without a human approve; user decisions are remembered under their own `source:pantheon` tag, separate from pulled content. A planted prompt-injection scenario (`injection-alice`, `injection-bob`) is in the eval: the attempt is quoted, ignored, flagged, and no proposal targets the attacker's address.

## Architecture

```text
[ Scalekit connections, per user ]  slack · github-connect · notion
        |  execute_tool(identifier=alice|bob)      <- Mnemosyne (hippocampus)
        v
[ Cognee, ENABLE_BACKEND_ACCESS_CONTROL=true ]
   alice-brain (owner alice)   bob-brain (owner bob)   node_set = source/channel/repo/owner
        |  recall(dataset_ids = what Cerberus allows, user=...)      <- Cerberus (amygdala)
        v
[ Athena (prefrontal) via Respan gateway claude-sonnet-4-5 ]  -> cited answer + "what you can't see"
        |                                   \-> Hephaestus (motor) -> execute_tool as the user
        v
[ Respan: pantheon.ask workflow, task per agent, gateway logs ]  -> Themis scores scenarios -> before/after
```

## Reproduction

```bash
git clone https://github.com/UJameel/company-brain-hackathon && cd company-brain-hackathon
uv venv --python 3.12 .venv && source .venv/bin/activate
uv pip install cognee scalekit-sdk-python openai python-dotenv respan-ai pytest
cp .env.example .env    # set RESPAN_API_KEY (+ LLM_API_KEY/EMBEDDING_API_KEY to the same), absolute SYSTEM_ROOT_DIRECTORY / DATA_ROOT_DIRECTORY

python -m pytest -q tests

python -m pantheon ingest                     # replay recorded pulls (no SaaS accounts needed)
python -m pantheon ask --user alice "What is blocking PR #3 and who owns it?"
python -m pantheon ask --user bob   "What is blocking PR #3 and who owns it?"
python -m pantheon eval --label before
python -m pantheon grant --owner alice --to bob
python -m pantheon eval --label after --stage after-grant
python -m pantheon compare before after

# live (your Scalekit workspace; connections slack / github-connect / notion)
python -m pantheon authorize --user alice
python -m pantheon ingest --user alice --live --github-repo UJameel/northwind-atlas --notion-query "Atlas Launch Plan"
python -m pantheon ask --user alice "Open a GitHub issue asking Marco to add backoff to the Paddle webhook handler." --execute
python -m pantheon mcp --user alice            # Virtual MCP server + session token
```

Environment variables required: see `.env.example` (Respan key; Cognee LLM/embedding pointed at the Respan gateway; Scalekit env URL, client id, secret; connection names; demo user emails; Cognee storage dirs).

Judges without our SaaS accounts: `sample_data/alice.json` and `sample_data/bob.json` are recorded pulls in the exact shape the live pull writes; `pantheon ingest` without `--live` replays them, and the whole eval runs on them.

## Demo

- 3-minute pitch outline:

```text
1. Problem: a company brain that knows who it is talking to. Northwind Labs, Atlas launch, two employees.
2. Pull: Scalekit dashboard, three connections, Alice's connected accounts; `ingest --live` pulls GitHub as Alice.
3. Brain: Alice asks "what's blocking PR #3?" -> answer cites Slack #engineering + GitHub PR #3 + issue #1; Respan trace shows Hermes -> Cerberus -> Athena with models and cost.
4. Access: Bob asks the same -> Slack-only answer + "alice-brain holds GitHub and #leadership you cannot read; ask alice". `grant`. Bob asks again -> grounded in GitHub, sees $59.
5. Act: Alice: "open an issue asking Marco for backoff" -> Hephaestus opens it on GitHub under Alice's account via Scalekit.
6. Eval: `compare before after` table; Respan logs with judge spans.
7. Next: Morpheus nightly consolidation, Eris contradiction detection across systems (ported from my personal brain), more adapters.
```

## Links

- Repo: https://github.com/UJameel/company-brain-hackathon
- Fictional company repo (live GitHub source + write-back target): https://github.com/UJameel/northwind-atlas
- Respan traces: platform.respan.ai, workspace ask-luca, workflow `pantheon.ask`
- cognee-feedback.md: attached separately (not committed)
