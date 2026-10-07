# Pantheon web: landing page, demo console, hosted API

Date: 2026-10-07. Status: draft for review. Visual reference: the approved mockup
(https://claude.ai/artifact/7Qr4vWBTGXc21mWpMDhvFM), classical theme, burnt orange accent.

## 1. Purpose

Two user-facing surfaces on Vercel and one hosted backend on Fly.io, built around the
existing `pantheon` package without changing it.

- `/` is a landing page that explains what Pantheon is and why a company needs it. Its
  centrepiece is a 3D brain drawn as a knowledge graph that rotates to each region as the
  reader scrolls through the seven agents.
- `/demo` is the console used in the three-minute live demo and by judges afterwards. It
  shows the access story on screen: two users, one question, the hidden datasets, a live
  grant, the changed answer, the agent feed, per-step model and cost, and the before and
  after eval scores.
- `api/` is a FastAPI service that wraps `hermes.ask` and `cerberus.grant`, runs Themis's
  deterministic fact check on live traffic, and ships in a Docker image together with the
  ingested Cognee state.

Rubric coverage the web surfaces are responsible for: Demo (5), the "visible on screen"
half of Secure access story (20), the live-traffic bonus in Evaluation (20), and the
first impression that decides Company Brain quality (30).

## 2. Constraints

- Nothing inside `pantheon/`, `evals/`, `sample_data/`, `tests/` or `.env` changes. The
  backend session owns those.
- The web app never runs ingest or eval. It only calls ask, grant, and reads results files.
- Only one process may open a given user's Cognee graph at a time (Ladybug file lock). The
  API is a single uvicorn worker and serialises asks per user with an asyncio lock.
- No secrets in the repo. Fly secrets come from `.env` via `fly secrets import`.
- Zero em-dashes in visible copy. One accent colour. Reduced motion respected everywhere.

## 3. Architecture

```text
Vercel  web/  (Next.js 15, App Router, TypeScript, Tailwind v4)
   /        landing            -> recorded run (static JSON) for the hero replay
   /demo    console            -> NEXT_PUBLIC_PANTHEON_API, falls back to recorded run
                                     |
                                     v  HTTPS, CORS allow-list
Fly.io  api/  (FastAPI, 1 machine, 1 GB, min_machines_running = 1, no volume)
   POST /ask  POST /grant  POST /reset  GET /evals  GET /scenarios  GET /health
   imports pantheon.hermes, pantheon.cerberus, pantheon.themis.fact_check
   state: /app/state (live copy)  <- /app/state-pristine (baked at build)
```

Repo layout added by this work:

```text
api/            server.py, pricing.py, tests/
web/            Next.js app
docs/superpowers/specs/   this file
Dockerfile  fly.toml  .dockerignore   repo root
```

## 4. API

Python 3.12, FastAPI (already in the venv), uvicorn, one worker. `api/server.py` is under
150 lines.

### 4.1 Routes

| Route | Body | Returns |
|---|---|---|
| `POST /ask` | `{user: "alice"\|"bob", question: str, dry_run: bool = true}` | the `hermes.ask` dict plus `themis` (see 4.2) and `cost_usd` |
| `POST /grant` | `{owner: "alice", to: "bob"}` | `{message: str, state: {grants: [...]}}` |
| `POST /reset` | none | `{ok: true}` then the process exits with code 0 and Fly restarts it |
| `GET /evals` | none | `{before: results\|null, after: results\|null}` parsed from `evals/results-before.json` and `results-after.json` |
| `GET /scenarios` | none | the contents of `evals/scenarios.json` |
| `GET /health` | none | `{ok: true, mode: "live", users: ["alice","bob"]}` |

### 4.2 Themis on live traffic

If the question matches a scenario in `scenarios.json` for the same user (exact string
match after trim and case fold), the server runs `themis.fact_check(scenario, result)` and
attaches `themis: {scenario_id, fact_score, hits, missing, leaks, grounded, ungrounded}`.
No LLM judge on live traffic; the fact check costs nothing and is independent of Athena.
When no scenario matches, `themis` is `null`.

### 4.3 Cost estimate

`api/pricing.py` holds a dict of USD per million tokens by model slug. The server sums
`usage` rows into `cost_usd`. Values are estimates and the UI labels them as such.

| model | input | output |
|---|---|---|
| gpt-4o-mini | 0.15 | 0.60 |
| claude-sonnet-4-5 | 3.00 | 15.00 |
| claude-haiku-4-5 | 1.00 | 5.00 |

### 4.4 Behaviour

- Per-user `asyncio.Lock` around `hermes.ask` so two asks for the same user never overlap.
- CORS allow-list: `https://<vercel-domain>`, `http://localhost:3000`.
- `/grant` and `/reset` require header `X-Demo-Key` equal to env `DEMO_KEY`. The web app
  sends it from a public env var; this is a speed bump against drive-by writes, not auth.
- Startup: if `/app/state` is empty, copy `/app/state-pristine` into it. `/reset` deletes
  `/app/state`, copies pristine back, then `os._exit(0)`. Fly's restart policy brings the
  machine back in a few seconds; the UI polls `/health` and shows "restarting".
- Config: `SYSTEM_ROOT_DIRECTORY=/app/state/system`, `DATA_ROOT_DIRECTORY=/app/state/data`,
  `HF_HUB_OFFLINE=1`, `TOKENIZERS_PARALLELISM=false`, `ENABLE_BACKEND_ACCESS_CONTROL=true`
  plus the LLM, embedding, Respan and Scalekit variables from `.env`.

## 5. Web app

### 5.1 Stack

Next.js 15 App Router, TypeScript, Tailwind v4, Motion (`motion/react`) for reveals and
layout transitions, `three` for the brain (plain three in one client component, no fiber),
`@phosphor-icons/react` at stroke 1.5, fonts through `next/font/google`: Cormorant
Garamond (500, 600, italic 500), Geist, Geist Mono. One icon family, one font stack.

### 5.2 Design tokens

Defined once in `web/app/globals.css` as CSS variables and mapped into Tailwind's theme.
Dark theme locked; no light mode.

```text
--bg #121010   --bg-2 #181514   --bg-3 #201b19   --line #2b2421   --line-2 #3b312b
--fg #efe6d8   --fg-2 #c3b6a5   --muted #8a7c6c
--accent #c8602c   --accent-hi #e8843f   --accent-dim rgba(200,96,44,.16)   --accent-ink #1c0d05
radius 2px everywhere; buttons uppercase 13px tracking .08em; data in Geist Mono tabular
```

The accent has one meaning: lit, readable, granted. Hidden or inactive things are neutral.
Semantic state in the console (a failed fact check) uses muted, never a second hue.

### 5.3 Landing page sections

Each section is its own server component; motion lives in client leaves.

1. **Nav.** Brand mark and wordmark, four anchors, one primary CTA "Open the demo". 72px.
2. **Hero.** Asymmetric split. Left: eyebrow "A company brain, run by gods", headline
   "It knows your company. It only tells you what you may know." with the last clause in
   italic accent, a subtext of at most 20 words (the mockup's is trimmed to fit), CTAs
   "Open the demo" and "View on GitHub". Right: the
   3D brain in autoplay mode cycling regions every 2.6 s with a mono caption "region · agent".
3. **The problem.** One carved statement headline, two columns under hairlines.
4. **The pantheon (scrollytelling).** Left: the 3D brain, sticky, with a label showing the
   active agent and region. Right: seven agent blocks, each 62vh tall on desktop, with the
   region name, the god's name in 64px serif, "In you" (what the region does in a human),
   "In Pantheon" (what the agent does), and the layer it sits on. The block in view is
   full opacity; others dim to 38%. Copy is in the mockup and is final unless the backend
   session changes an agent's job.
5. **The access story.** Three beats in one hairline grid: Isolation, Alice shares, Changed
   result. The middle beat carries the accent tint. Each beat shows real feed lines from the
   recorded run.
6. **Three layers.** Scalekit, Cognee, Respan as three columns under a rule. Logos inline
   SVG from Simple Icons where a mark exists; otherwise the serif wordmark.
7. **Evaluation.** Two numbers at 96px serif, before and after, read from the committed
   results files at build time; the change named as the grant. If either file is missing,
   the section renders sample values with a visible "sample" label.
8. **Quickstart.** The five README commands in a code block with a copy button.
9. **Footer.** Hackathon credit and repo link.

Eyebrows: hero and pantheon only. Layout families: split, statement, scrolly, grid, columns,
numbers, code. Hero fits the first viewport at 1440x900 and at 390 wide.

### 5.4 The 3D brain (`web/components/Brain.tsx`)

**What it is.** A point cloud of about 2,400 nodes (1,200 on screens under 768px) sampled
inside a parametric brain volume, each linked to its two nearest neighbours, drawn with
`three` as `Points` plus `LineSegments`. It is the knowledge graph the product builds,
not an illustration.

**Geometry.** Two hemispheres, each an ellipsoid (rx .62, ry .48, rz .40) offset ±0.10 on
z, with a radial displacement of ±0.04 from three summed sine terms to suggest gyri. Points
within 0.03 of z = 0 are dropped to form the longitudinal fissure. A cerebellum ellipsoid
(rx .22, ry .14, rz .26) sits at (−.42, −.34, 0). A brain stem cylinder (r .07) runs from
(−.28, −.40, 0) down to (−.30, −.78, 0). Sampling is seeded so the cloud is identical on
every load. Neighbour search uses a uniform grid, under 60 ms at 2,400 points, and runs
once on mount.

**Regions.** Assigned by position in the same way as the 2D mockup, now in 3D:
thalamus (sphere r .10 at (0,.02,0)), amygdala (two spheres r .06 at (.12,−.16,±.22)),
hippocampus (two curved tubes r .05 from (.08,−.18,±.24) to (−.18,−.14,±.26)), prefrontal
(x > .36 and y > −.10), orbitofrontal (x > .26 and −.34 < y ≤ −.10), motor (−.08 < x < .12
and y > .36), sleep (whole brain), everything else cortex.

**Camera choreography.** An orbit target per region as (azimuth°, elevation°, distance):

| region | az | el | dist | note |
|---|---|---|---|---|
| thalamus | 60 | 18 | 1.9 | three-quarter front, pushed in |
| amygdala | 95 | −22 | 1.8 | from below, side |
| hippocampus | 120 | −30 | 1.8 | continues the orbit downward and back |
| prefrontal | 15 | 8 | 2.1 | nearly face on |
| motor | 40 | 70 | 2.0 | from above |
| orbitofrontal | 20 | −35 | 1.9 | from below the eyes |
| sleep | continuous | 10 | 2.4 | slow full rotation, 40 s per turn |

Per frame the camera eases toward its target with a critically damped spring (stiffness
120, damping 22). Each region's glow eases 0 to 1 the same way. Node material: lit nodes
are accent at size 3.2px with an additive halo sprite; unlit nodes are bone at 22% and
1.8px; edges touching the lit region are accent at 40%, others bone at 7%. Ambient
drift: each node has a 2.2px sinusoidal wobble. All of this runs in the render loop only
while the canvas is in the viewport (IntersectionObserver) and the tab is visible.

**Scroll binding.** The pantheon section observes its seven agent blocks with
`rootMargin: -40% 0px -40% 0px`; the block crossing the centre band sets `activeRegion`.
The component receives it as a prop and lerps. Section scroll progress (Motion
`useScroll` on the section) adds a continuous ±12° azimuth offset so the brain keeps
turning between blocks. No `scroll` event listeners anywhere.

**Modes.** `mode="autoplay"` (hero) cycles regions on a 2.6 s timer and adds pointer
parallax of ±6° from the cursor using a motion value, never React state.
`mode="scroll"` (pantheon) takes `activeRegion` from the parent.

**Reduced motion and fallback.** Under `prefers-reduced-motion`, camera moves and glow
changes are instant, drift and autoplay are off, and the pantheon brain still follows the
active block. If WebGL is unavailable the component renders the 2D canvas version from
the mockup with the same region logic. The canvas is `aria-hidden`; the visible label next
to it carries the information.

**Performance.** One `WebGLRenderer` per instance, pixel ratio capped at 2, geometry built
once, materials shared, disposed on unmount. Target 60 fps on an M1 MacBook Air and 30 fps
on a mid-range phone. The landing page's LCP element is the hero headline, not the canvas;
the brain mounts after hydration with a static poster image (`/brain-poster.webp`, a
captured frame) underneath to avoid a blank hero.

### 5.5 Demo console (`/demo`)

Density 8, no marketing moves. Layout at 1440x900 fits in one viewport without scrolling.

- **Top bar.** Brand, "Northwind Labs", three layer badges, a Respan trace link, a live
  or recorded pill, "Reset" (calls `/reset`, shows a restarting state until `/health`
  answers).
- **Question bar.** One input, "Ask both", four scenario chips: PR #42 blocker, Pro plan
  price, Launch risk, Draft Slack to Priya. Enter submits.
- **Two panes, Alice and Bob.** Identity line with sources. Agent feed with four rows that
  light in order (250 ms stagger) once the response arrives; Hephaestus row shows "not
  needed" for questions. Answer with accent-highlighted facts (no markup from the model;
  the UI highlights scenario `must_mention` terms when a Themis result exists). Source
  chips, lit when present. Hidden card "N datasets you can't see" listing name, owner and
  sources; on Bob's side it carries "Grant as Alice", which calls `/grant` and then
  offers "Ask again". Action card when `action` is non-null: tool, status, acting
  identity, draft text. Themis line when present: fact score, hits, missing, leaks. Usage
  table: step, model, prompt/completion tokens, estimated cost, total latency.
- **Eval strip.** Before and after means from `/evals`, the change named "grant alice to
  bob", and paired per-scenario bars. Hidden entirely when both files are missing.
- **States.** Loading: skeleton rows in the shape of the feed and answer. Error: inline
  message in the pane with the server's detail. Recorded mode: a pill and a note that the
  API is unreachable and answers come from the recorded run.

### 5.6 Recorded run

`web/data/recorded.json` holds real `/ask` responses captured once from the local API for
the four scenario questions, for both users, before and after the grant. The hero replay
and recorded mode read it. A script `web/scripts/record.ts` regenerates it against a
running API.

## 6. Deployment

### 6.1 Docker image

Multi-stage, adapted from Cognee's official Dockerfile:

1. `ghcr.io/astral-sh/uv:python3.12-bookworm-slim` installs `cognee scalekit-sdk-python
   openai python-dotenv respan-ai fastapi uvicorn` from a pinned `api/requirements.txt`.
2. `ghcr.io/ladybugdb/extension-repo` provides the Ladybug JSON extension, copied to the
   path Cognee's image uses, because the runtime install fails for a non-root user.
3. Final stage copies `pantheon/`, `api/`, `evals/scenarios.json`, `evals/results-*.json`,
   and the ingested state into `/app/state-pristine/{system,data}`. Runs as uid 1000.
   `CMD uvicorn api.server:app --host 0.0.0.0 --port 8080`.

The state is copied only after the backend session has exited cleanly, so Ladybug's
write-ahead log is checkpointed; the build script refuses to run if any `.lbug.wal` file
is larger than zero bytes. Build with `--platform linux/amd64` from Apple Silicon.

### 6.2 Fly

`fly.toml`: app `pantheon-api`, region `sjc`, `min_machines_running = 1`,
`auto_stop_machines = false`, 1 GB shared CPU, internal port 8080, health check on
`/health`, restart policy always. Secrets imported from `.env`. Deploy is `fly deploy`.

### 6.3 Vercel

Root directory `web`. Env: `NEXT_PUBLIC_PANTHEON_API`, `NEXT_PUBLIC_DEMO_KEY`. Production
branch is whatever branch holds this work; preview deploys for PRs.

## 7. Testing

- `api/tests/test_server.py` with FastAPI's TestClient and `hermes.ask` monkeypatched:
  ask returns the contract shape plus `themis` and `cost_usd`; a matching scenario yields
  a fact score; grant requires the demo key and returns the message; evals handles
  missing files; health reports mode.
- `api/tests/test_pricing.py`: cost for a known usage list.
- Web: Vitest for the brain's region assignment and the neighbour search (pure
  functions), and for the cost and highlight helpers. Playwright: `/demo` in recorded mode
  asks a question and shows both panes, grant flips Bob's hidden card, landing page has no
  horizontal overflow at 390 and 1440, and each agent block lights the matching label.
  Screenshots saved as evidence.
- Lighthouse on `/` before calling it done: performance above 85 on desktop.

## 8. Order of work

1. `api/` server and tests against the local Cognee state (needs the backend session idle).
2. `web/` scaffold, tokens, fonts, console at `/demo` in recorded mode, then live.
3. Record `recorded.json` from the local API.
4. Brain component: geometry and regions with unit tests, then rendering, then choreography.
5. Landing page sections.
6. Dockerfile and Fly deploy as soon as ingest is final.
7. Vercel, Playwright pass, Lighthouse, screenshots.

## 9. Risks and open questions

- The backend session may change the `hermes.ask` shape or the agent list. The console
  renders unknown feed lines verbatim and the pantheon section copy is in one data file.
- Grants on the hosted API are shared state. Reset exists for that; the console shows the
  current grant list so a judge can see whether someone already granted.
- Three.js adds roughly 150 KB gzipped. Acceptable for a landing page whose point is the
  brain; it is dynamically imported so `/demo` never loads it.
- Branching: both Claude sessions share one working tree on `main`. This work lands on a
  branch through a separate git worktree so the backend session's checkout is untouched.
  Decision needed from Usman on whether to merge to `main` before the demo or deploy from
  the branch.
