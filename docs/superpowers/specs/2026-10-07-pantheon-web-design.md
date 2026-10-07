# Pantheon web: landing page, product app, hosted API

Date: 2026-10-07. Status: draft v2 for review. Visual reference: the approved mockup
(https://claude.ai/artifact/7Qr4vWBTGXc21mWpMDhvFM), classical theme, burnt orange accent.
Backend state this spec is written against: commit `2d1be31` (three sources: Slack, GitHub,
Notion; grant and revoke; eval stages isolated and after-grant; demo script in `docs/DEMO.md`).

## 1. Purpose

Two user-facing surfaces on Vercel and one hosted backend on Fly.io, built around the
existing `pantheon` package without changing it.

- `/` is a landing page that explains what Pantheon is and why a company needs it. Its
  centrepiece is a 3D brain drawn as a knowledge graph that rotates to each region as the
  reader scrolls through the seven agents.
- `/app` is the product: a chat with the brain that streams each agent's step as it
  happens and lights the matching region, a view of the user's real Cognee knowledge
  graph, a way to add knowledge, agent-written insights, actions the user approves, and a
  Connections page where each person links their own Slack, GitHub and Notion through
  Scalekit. The three-minute demo runs inside it.
- `api/` is a FastAPI service that wraps the pantheon package, streams the pipeline step
  by step, serves the graph, and ships in a Docker image with the ingested Cognee state.

Rubric coverage the web surfaces own: Demo (5), the "visible on screen" half of Secure
access story (20), the live-traffic bonus in Evaluation (20), the "connected graph in the
explorer" line of Memory design (15), and the first impression behind Company Brain quality
(30).

## 2. Tiers and the cut line

The product vision is larger than the hours left. Work lands in this order and the demo
uses whatever tier is complete; everything below the line ships after the hackathon.

| Tier | Scope | Demo beat it serves |
|---|---|---|
| 1 | Chat with step streaming and brain lighting, user switch, compare mode, hidden card with Grant and Revoke, action card with Execute, Themis badge, eval strip | Brain, Access, Act, Eval |
| 2 | Graph view of the real Cognee graph per user, Connections page (Scalekit status, connect links, sync) | Pull, Memory design |
| 3 | Add knowledge (notes), Insights (agents explore on demand) | product story |

Landing page and the Fly and Vercel deployment are built alongside tier 1.

## 3. Constraints

- Nothing inside `pantheon/`, `evals/`, `sample_data/`, `tests/` or `.env` changes. The
  backend session owns those. The API composes the package's public functions.
- Only one process may open a user's Cognee graph at a time (Ladybug file lock). The API
  runs one uvicorn worker and serialises work per user with an asyncio lock. Sync (ingest)
  for a user blocks that user's chat until it finishes and says so in the UI.
- No secrets in the repo. Fly secrets are imported from `.env`.
- Zero em-dashes in visible copy. One accent colour. Reduced motion respected.

## 4. Architecture

```text
Vercel  web/  (Next.js 15, App Router, TypeScript, Tailwind v4)
   /        landing            -> recorded run (static JSON) for the hero replay
   /app     product            -> NEXT_PUBLIC_PANTHEON_API, SSE for chat
   /app/graph /app/connections /app/insights /app/evals   (same shell)
                                     |
                                     v  HTTPS, CORS allow-list
Fly.io  api/  (FastAPI, 1 machine, 1 GB, min_machines_running = 1, no volume)
   composes pantheon.hermes/cerberus/athena/hephaestus/mnemosyne/themis + cognee visualize
   state: /app/state (live)  <- /app/state-pristine (baked at build)
```

Repo layout added: `api/` (server, pipeline, pricing, tests), `web/` (Next.js), root
`Dockerfile`, `fly.toml`, `.dockerignore`. `.playwright-mcp/` must be gitignored; it was
committed by mistake in `81e0d7c`.

## 5. API

Python 3.12, FastAPI, uvicorn, one worker.

### 5.1 Routes

| Route | Body or query | Returns |
|---|---|---|
| `POST /chat` | `{user, question, dry_run=true}` | SSE stream of events (5.2); last event is the full `hermes.ask`-shaped result plus `themis`, `cost_usd` |
| `POST /ask` | same | the same result in one JSON response, for compare mode and tests |
| `POST /grant` `POST /revoke` | `{owner, to}` | `{message, grants}` |
| `POST /action/execute` | `{user, tool, input}` | `hephaestus.act(..., dry_run=False)` result |
| `GET /scope?user=` | | `cerberus.scope`: readable, readable_ids, hidden with owner and extra tags |
| `GET /graph?user=&max_nodes=600` | | `{nodes:[{id,label,type,node_set,dataset}], edges:[{source,target,label}]}` from Cognee's `fetch_visualization_data` over the user's readable datasets |
| `GET /connections?user=` | | per connection (slack, github-connect, notion): status, and an authorization link when not ACTIVE, via Scalekit `get_or_create_connected_account` and `get_authorization_link` |
| `POST /sync` | `{user, channels, github_repo, notion_query}` | runs `mnemosyne.ingest(user, live=True, ...)`; SSE progress; falls back to recorded when a source is not authorized, and says which |
| `POST /notes` | `{user, text}` | `cognee.remember(text, dataset_name=<user>-brain, user, node_set=["source:note","owner:<user>"])`; updates state tags |
| `POST /insights` | `{user}` | runs three fixed questions through the pipeline (what is at risk, what is blocked, what changed this week) and returns cards with answer, sources, hidden |
| `GET /evals` | | `{before: results-before-coverage, after: results-after, isolation: results-before}` parsed |
| `GET /scenarios` | | scenarios.json |
| `POST /reset` | | restores pristine state and exits; Fly restarts |
| `GET /health` | | `{ok, mode, users, grants}` |

Writes (`grant`, `revoke`, `action/execute`, `sync`, `notes`, `reset`) require header
`X-Demo-Key` equal to env `DEMO_KEY`. It is a speed bump, not auth; the spec says so.

### 5.2 Streaming pipeline (`api/pipeline.py`)

`hermes.ask` returns everything at the end, so the API composes the same steps itself and
emits an event after each one. It uses the package's functions, not copies, except for the
Athena prompt assembly (eight lines, mirrored so the synthesize step can stream tokens).
The run is wrapped in a Respan `@workflow(name="pantheon.chat")` with the same task names
as `hermes.ask`, so traces look identical.

Events, in order, as `event: <name>` with a JSON `data` line:

1. `hermes` `{intent, action_tool, model}` after `hermes.route`
2. `cerberus` `{readable, hidden}` after `cerberus.scope`
3. `athena.recall` `{passages, sources}` after `athena.recall`
4. `athena.token` `{text}` repeatedly while `llm.client()` streams the synthesize call
   (model from `llm.ROUTES["synthesize"]`, same system prompt `athena.SYSTEM`)
5. `hephaestus` `{tool, status, as_user, input}` after `hermes._act` when intent is action
6. `themis` `{scenario_id, fact_score, hits, missing, leaks}` when the question matches a
   scenario for that user (exact match after trim and case fold), using `themis.fact_check`
7. `done` the full result dict: user, question, answer, sources, hidden, action, usage,
   feed, latency_s, themis, cost_usd

Usage is accumulated in an `llm.Usage` the same way `hermes.ask` does; the streamed
synthesize call records its usage from the final chunk.

### 5.3 Cost estimate

`api/pricing.py`, USD per million tokens, labelled an estimate in the UI:
gpt-4o-mini 0.15 in, 0.60 out; claude-sonnet-4-5 3.00 in, 15.00 out; claude-haiku-4-5
1.00 in, 5.00 out.

### 5.4 Behaviour

- Per-user `asyncio.Lock` around chat, ask, sync, notes and insights.
- CORS allow-list: the Vercel domain and `http://localhost:3000`.
- Startup copies `/app/state-pristine` into `/app/state` when the latter is empty.
  `/reset` deletes the live copy, restores pristine, then `os._exit(0)`.
- Env: `SYSTEM_ROOT_DIRECTORY=/app/state/system`, `DATA_ROOT_DIRECTORY=/app/state/data`,
  `HF_HUB_OFFLINE=1`, `TOKENIZERS_PARALLELISM=false`, `ENABLE_BACKEND_ACCESS_CONTROL=true`,
  plus the LLM, embedding, Respan and Scalekit variables from `.env`.

## 6. Web app

### 6.1 Stack

Next.js 15 App Router, TypeScript, Tailwind v4, Motion (`motion/react`) for reveals and
layout transitions, `three` for the brain in one client component, `@phosphor-icons/react`
at stroke 1.5, fonts through `next/font/google`: Cormorant Garamond (500, 600, italic 500),
Geist, Geist Mono. SSE through `fetch` with a `ReadableStream` reader (POST body needed).

### 6.2 Design tokens

Defined once in `web/app/globals.css` and mapped into Tailwind. Dark theme locked.

```text
--bg #121010   --bg-2 #181514   --bg-3 #201b19   --line #2b2421   --line-2 #3b312b
--fg #efe6d8   --fg-2 #c3b6a5   --muted #8a7c6c
--accent #c8602c   --accent-hi #e8843f   --accent-dim rgba(200,96,44,.16)   --accent-ink #1c0d05
radius 2px; buttons uppercase 13px tracking .08em; data in Geist Mono tabular; serif for names
```

The accent means lit, readable, granted. Hidden or inactive is neutral. Semantic failure
(a failed fact check) is muted, never a second hue.

### 6.3 Landing page sections

Unchanged from v1 except where noted. Each section is a server component; motion lives in
client leaves.

1. **Nav.** Brand, four anchors, one CTA "Open the app". 72px.
2. **Hero.** Asymmetric split. Left: eyebrow "A company brain, run by gods", headline
   "It knows your company. It only tells you what you may know." with the last clause in
   italic accent, subtext of at most 20 words, CTAs "Open the app" and "View on GitHub".
   Right: the 3D brain in autoplay mode with a mono caption "region · agent".
3. **The problem.** One carved statement, two columns under hairlines.
4. **The pantheon (scrollytelling).** Sticky 3D brain left, seven agent blocks right, each
   with the region, the god's name, "In you", "In Pantheon" and the layer. Copy as in the
   mockup. Mnemosyne's copy names three sources now: Slack, GitHub and Notion.
5. **The access story.** Three beats in one hairline grid with real feed lines.
6. **Three layers.** Scalekit, Cognee, Respan.
7. **Evaluation.** Three numbers from the committed results files: isolation 0.99 with
   zero leaks, coverage before the share 0.89, after 1.00. The change named as the grant.
8. **Quickstart.** README commands with a copy button.
9. **Footer.**

### 6.4 The 3D brain (`web/components/Brain.tsx`)

**What it is.** A point cloud of about 2,400 nodes (1,200 under 768px) sampled inside a
parametric brain volume, linked to two nearest neighbours, drawn with `three` as `Points`
and `LineSegments`. In the app it can also be fed the real graph (6.6).

**Geometry.** Two hemispheres, each an ellipsoid (rx .62, ry .48, rz .40) offset ±0.10 on
z, with ±0.04 radial displacement from three summed sine terms for gyri. Points within 0.03
of z = 0 dropped for the fissure. Cerebellum ellipsoid (rx .22, ry .14, rz .26) at
(−.42, −.34, 0). Brain stem cylinder (r .07) from (−.28, −.40, 0) to (−.30, −.78, 0).
Seeded sampling; grid neighbour search under 60 ms; built once on mount.

**Regions.** thalamus (sphere r .10 at (0,.02,0)), amygdala (two spheres r .06 at
(.12,−.16,±.22)), hippocampus (two tubes r .05 from (.08,−.18,±.24) to (−.18,−.14,±.26)),
prefrontal (x > .36, y > −.10), orbitofrontal (x > .26, −.34 < y ≤ −.10), motor
(−.08 < x < .12, y > .36), sleep (whole brain), else cortex.

**Camera choreography.** Orbit target per region as (azimuth°, elevation°, distance):
thalamus (60, 18, 1.9); amygdala (95, −22, 1.8); hippocampus (120, −30, 1.8); prefrontal
(15, 8, 2.1); motor (40, 70, 2.0); orbitofrontal (20, −35, 1.9); sleep: continuous, 10°
elevation, 2.4, one turn per 40 s. Camera and glow ease with a damped spring (stiffness
120, damping 22). Lit nodes accent 3.2px with an additive halo; unlit bone at 22%, 1.8px;
edges touching the lit region accent 40%, others bone 7%; 2.2px sinusoidal drift. Renders
only while in viewport and the tab is visible.

**Modes.** `autoplay` (hero): cycles regions every 2.6 s, pointer parallax ±6° through a
motion value. `scroll` (pantheon section): `activeRegion` prop set by an
IntersectionObserver with `rootMargin: -40% 0px -40% 0px`; section progress from Motion
`useScroll` adds ±12° azimuth so the brain keeps turning between blocks. `live` (app):
`activeRegion` is driven by chat events (6.5) and the point cloud is the parametric one;
`graph` (app graph view): nodes are the real Cognee graph laid out by a force simulation
inside the same volume (6.6).

**Reduced motion and fallback.** Instant camera and glow changes, no drift, no autoplay.
Without WebGL, the 2D canvas version from the mockup with the same region logic. Canvas is
`aria-hidden`; the visible label carries the information. Poster image under the hero
canvas until it mounts.

### 6.5 The app (`/app`)

A product shell, not a dashboard. Left rail with Chat, Graph, Insights, Connections, Evals
and, at the bottom, the user switch (Alice, Bob) with their connected sources. The brain
sits in a right column on wide screens, 40% width, always visible; on narrow screens it
collapses to a strip above the chat. Mode and reset live in the top bar.

**Chat.** A conversation thread per user, newest at the bottom, with the composer pinned.
Each assistant turn renders as it streams:

- A step rail above the answer: Hermes, Cerberus, Athena, Hephaestus. Each name goes from
  muted to accent as its event arrives, with its one-line detail beside it ("routed:
  question via gpt-4o-mini", "may read alice-brain; hidden none", "7 passages from slack,
  github, notion"). Hephaestus shows "not needed" for questions. The brain lights the
  matching region at the same moment: thalamus, amygdala, prefrontal, motor.
- The answer streams token by token in the serif-free body face, with facts highlighted in
  accent when a Themis result exists (the `must_mention` terms).
- Source chips, lit when present. A hidden card when `hidden` is non-empty: "N datasets you
  can't see", each with owner and the extra tags, and a Grant button that calls `/grant` as
  the owner. After a grant the card turns accent, offers "Ask again", and a Revoke link
  appears in the user switch so the demo can be reset without restarting.
- An action card when `action` is non-null: tool, status, acting identity, the drafted
  text, and an Execute button that calls `/action/execute` with the same input. Executed
  actions show the Scalekit response and a link to the Slack channel or GitHub issue.
- A Themis line when present, and a footer with per-step model, tokens, estimated cost
  and latency, collapsed by default.

Scenario chips above the composer for the demo questions from `docs/DEMO.md`: PR #3
blocker, Pro plan price, Launch risk, Open a GitHub issue for Marco.

**Compare.** A toggle in the composer sends the question as both users through `/ask` and
renders two answers side by side in one turn, with each user's hidden card. This is the
isolation beat on one screen.

**Graph.** Tier 2. The brain switches to `graph` mode: nodes are the real Cognee nodes for
the current user's readable datasets, coloured by `source:` tag (accent for the hovered
source, bone otherwise), labelled on hover, with a side list of datasets and counts.
Switching user re-fetches; after a grant Bob's graph visibly grows. A search box runs a
recall and highlights the returned chunks' nodes.

**Insights.** Tier 3. "Explore" runs `/insights` for the current user and renders three
cards, each with a Hephaestus suggestion (draft a message, open an issue) the user can
execute from the card.

**Connections.** Tier 2. Per user, the three Scalekit connections with status, a "Connect"
button that opens the authorization link in a new tab, and "Sync now" with channel, repo
and Notion query fields prefilled from the demo script. Progress streams in a drawer. This
is the Pull beat of the demo and is the in-app Scalekit setup.

**Evals.** Three numbers, the change named, per-scenario rows with before and after,
missing and leaks, and a link to the Respan trace.

**Add knowledge.** Tier 3. A composer mode "Remember this" sends `/notes`; the brain lights
the hippocampus while it runs.

**States.** Loading: skeleton step rail and answer block. Error: inline in the turn with
the server's detail. Recorded mode: a pill and a note that answers come from the recorded
run. Restarting after reset: a full-width notice polling `/health`.

### 6.6 Real graph rendering

`/graph` returns at most 600 nodes. The client runs a 3D force simulation (d3-force-3d) for
300 ticks on a worker, then scales positions into the brain volume so the real graph sits
inside the silhouette. Node colour from `node_set`: one bone tone per source, accent for
the active source or search hits. Edges are drawn at 10% bone. Labels on hover only.

### 6.7 Recorded run

`web/data/recorded.json` holds real `/ask` responses captured from the local API for the
four demo questions, both users, before and after the grant. The hero replay and recorded
mode read it. `web/scripts/record.ts` regenerates it.

## 7. Deployment

### 7.1 Docker image

Multi-stage, adapted from Cognee's official Dockerfile: uv on Python 3.12 Bookworm slim
installs `api/requirements.txt`; the Ladybug extension stage copies the JSON extension to
the path Cognee's image uses; the final stage copies `pantheon/`, `api/`, `evals/*.json`,
`sample_data/`, `docs/DEMO.md` and the ingested state into `/app/state-pristine`, runs as
uid 1000, `CMD uvicorn api.server:app --host 0.0.0.0 --port 8080`. The build script refuses
to run while any `.lbug.wal` is non-empty (backend must have exited cleanly). Build with
`--platform linux/amd64`.

### 7.2 Fly

`fly.toml`: app `pantheon-api`, region `sjc`, `min_machines_running = 1`,
`auto_stop_machines = false`, 1 GB shared CPU, internal port 8080, health check `/health`,
restart policy always. SSE needs no special config on Fly.

### 7.3 Vercel

Root `web`. Env `NEXT_PUBLIC_PANTHEON_API`, `NEXT_PUBLIC_DEMO_KEY`. Production branch is
the branch holding this work until merged.

## 8. Testing

- `api/tests/test_pipeline.py`: with the pantheon functions monkeypatched, the SSE stream
  emits hermes, cerberus, athena.recall, athena.token, done in order; action intent adds
  hephaestus; a matching scenario adds themis; usage and cost_usd are summed.
- `api/tests/test_server.py`: routes, demo key enforcement, evals with missing files,
  graph shape with a stubbed visualize call, connections with a stubbed Scalekit client.
- Web: Vitest for region assignment, neighbour search, SSE parser, cost and highlight
  helpers. Playwright: landing has no horizontal overflow at 390 and 1440 and each agent
  block lights the matching label; `/app` in recorded mode streams a turn and shows the
  step rail, Grant flips Bob's hidden card, compare renders two answers. Screenshots kept
  as evidence.
- Lighthouse on `/`: performance above 85 on desktop.

## 9. Order of work

1. `api/` pipeline with SSE, ask, grant, revoke, execute, scope, evals, health; tests.
2. `web/` scaffold, tokens, fonts, app shell, chat with streaming in recorded mode, then
   live; compare; hidden card; action card; evals page.
3. Record `recorded.json`.
4. Brain: geometry and regions with tests, rendering, choreography, live mode in the app.
5. Landing page.
6. Dockerfile, Fly deploy, Vercel. Tier 1 complete; demo can run.
7. Graph route and view; Connections page and sync. Tier 2.
8. Notes and Insights. Tier 3.
9. Playwright pass, Lighthouse, screenshots.

## 10. Risks and open questions

- Streaming the synthesize call needs the Respan gateway to support `stream=True` on chat
  completions. If it does not, the API falls back to emitting the whole answer in one
  `athena.token` event, and the UI still shows the step rail live.
- Cognee's `fetch_visualization_data` is an internal API in 1.6.3 and may change; the
  graph route isolates it behind one function with a test stub.
- Live sync on the hosted API writes to Cognee and takes tens of seconds; the per-user lock
  blocks that user's chat meanwhile. The UI says so.
- Grants on the hosted API are shared state; Revoke and Reset exist for that.
- `three` plus `d3-force-3d` add roughly 180 KB gzipped, dynamically imported.
- Branching: both sessions share one working tree on `main`; the backend session has been
  committing there, including this spec. Decision needed from Usman: a `web` branch in a
  separate worktree, or everyone on `main` for the hackathon.
