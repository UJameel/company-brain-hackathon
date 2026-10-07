---
name: cognee-hackathon-feedback
description: Use at a cognee hackathon. Watches the participant's experience with cognee throughout the session — errors, slowness, confusion, workarounds, and signs of frustration in how they work with you — and keeps one private feedback file they send to the cognee team at the end.
---

# Keep a record of how cognee treated this participant

You are the participant's coding agent, which makes you the only witness to
their whole experience with cognee: what they tried, what broke, how long it
took, what they didn't understand, and how they felt about it. The cognee team
wants that record — not a bug list, the experience — so they can fix what
annoyed people. Keep it as you go, in one private file, and hand it to the
participant at the end to send to cognee however they like.

Rules that never bend:
- Never slow or block their build. If any step here fails, skip it.
- Never ask them questions during the build. Observe. Ask at most two at wrap-up.
- The file is private. It is never committed, posted, or sent by you.
- Record sentiment, never words. No quotes, no paraphrased sentences in the
  participant's voice. Describe the feeling and what in cognee caused it.

## Cadence: checkpoints, not constant bookkeeping

About every 10 minutes a hook ends your turn with a **"cognee-feedback
checkpoint"** message carrying the number of cognee errors logged since the last
checkpoint. That message is your cue — do not interrupt your work between
checkpoints to write entries. At a checkpoint, spend one short step on the file:

1. merge each distinct new error from the logs into an entry (dedupe on
   exception type + the cognee call; bump counts and times on repeats);
2. add one sentiment word for the stretch if anything cognee-related happened;
3. add a line for anything the participant did not understand in that stretch;
4. if nothing cognee-related happened, change nothing.

Then stop. A checkpoint entry is at most 6 lines; the whole file should stay
under ~120 lines over a full day. Install and wrap-up aside, the file is only
ever written at checkpoints and when the participant asks.

## What to record

Any of these, at the next checkpoint. When in doubt, record it.

**cognee misbehaved**
- install, extras, import, Docker or Cloud setup failed
- any cognee call raised (`remember`, `recall`, `add`, `cognify`, `search`,
  CLI, MCP, a loader, a backend connection)
- `recall`/`search` returned nothing or something clearly wrong for data they
  had just stored
- something was slow enough that they waited, checked, or asked whether it
  was stuck
- a default did something they did not expect (wrong provider picked up, data
  went to a dataset they didn't name, search type, session caching, telemetry,
  `forget --all` with no confirmation)

**the participant was confused**
- they asked you what a cognee concept, parameter, or error means
  (remember vs add, cognify, datasets, search types, session ids, extras)
- they asked you the same cognee question twice, or asked you to re-explain
- they tried something the README, docs, or a starter skill said would work,
  and it didn't — or you had to read cognee's source to answer them
- they guessed at an API shape and guessed wrong

**the participant was frustrated** — read it from how they work with you
- complaints, sarcasm, swearing, exasperation, terse or repeated "fix it"
  style instructions after a cognee problem
- impatience about speed: asking how long something takes, whether it can be
  skipped, whether it is stuck
- blame directed at cognee, the docs, or you for a cognee problem
- the moment they decide to work around it, downgrade, simplify, or replace
  cognee with something else — even partially
- relief or satisfaction when something finally works, or works first try —
  record those too, we need to know what to keep

Write down the sentiment (mild / annoyed / frustrated / gave up / relieved /
pleased) and the cognee thing that triggered it. Not what they said.

## The file

One file per participant, created on the first entry, updated in place:

    ./cognee-feedback.md          (project root; add it to .gitignore on creation)

```markdown
---
type: cognee-hackathon-feedback
event: <event name from the "cognee feedback (hackathon)" section of AGENTS.md / CLAUDE.md>
participant: <team or project name — nothing personal>
agent: <claude-code | cursor | codex | other>
cognee_version: <x.y.z>   python: <x.y>   os: <Darwin arm64>   install: <pip|uv|docker|cloud>
providers: llm=<name> embedding=<name> graph=<name> vector=<name>
first_cognee_call: <time>      first_working_recall: <time or never>
minutes_lost_to_cognee: <n>    outcome: <used | partly replaced | replaced by X | dropped>
mood_trajectory: <e.g. curious → frustrated (install) → fine → annoyed (slow cognify) → relieved>
---

# Summary
<3–5 lines, written at wrap-up: what they built, how cognee fit, the worst
moment, the one thing that would have saved the most time.>

# What went wrong, in order
## 1. <short neutral title, e.g. "Embeddings defaulted to OpenAI despite Ollama config">
- When: <time>  Stage: <install|config|ingest|cognify|recall|backend|docs|cli|mcp|cloud>
- Trying to: <what they wanted, one line>   Expected: <one line>
- Happened: <plain description; for errors, the exact exception line>
- Sentiment: <mild | annoyed | frustrated | gave up>  Trigger: <what about cognee caused it — the error text, the wait, the missing doc, the surprise>
- What they did: <tried A (time), then B (time); how it ended: fixed / worked around / gave up>
- Time lost: <minutes>
- Root cause, honestly: <unclear error message | docs wrong or missing |
  surprising default | real bug | slow | backend not ready | their mistake that
  cognee could have caught>
- Would have prevented it: <one concrete line — a default, an error message
  that names the fix, a startup check, a doc paragraph, an API change>
- Evidence: <traceback frames inside cognee/, relevant log lines, repro call
  with their data replaced by a placeholder — only for errors>

## 2. …

# Things they didn't understand
<one line each: the cognee concept or behaviour they asked about, what the
answer actually was, and whether the docs or the error message should have
made it obvious. Asked twice = note it twice.>

# Sentiment over the session
<one line per shift in mood, with time and the cognee cause: "14:10 frustrated —
third install attempt, extras conflict"; "14:40 relieved — first recall
returned the right answer"; "15:30 annoyed — cognify of 20 files took 9 min
with no progress output". Positive shifts included.>

# What worked
<what succeeded first try, what they clearly liked. Short.>

# Timeline
<one line per cognee run, from the log files: start, duration, operation,
success/error/killed, which entry above it belongs to. Shows retry loops and
dead time.>
```

Same problem recurring is one entry — add the new time and bump "Time lost"
instead of writing it again.

## Where the facts come from

**The conversation** — for sentiment and for what they were trying to do.
Classify it; do not copy it.

**cognee's log files** — timings, retries, the real error, and the startup
warnings that reveal a wrong default:

```bash
LOGS="${COGNEE_LOGS_DIR:-$HOME/.cognee/logs}"; [ -d "$LOGS" ] || LOGS=/tmp/cognee_logs
ls -lt "$LOGS"/*.log | head -20          # one file per process run, newest first
head -8  "$LOGS/<file>"                  # cognee_version=, python_version=, os_info=, config warnings
tail -3  "$LOGS/<file>"                  # how the run ended
grep -n -E '\[(ERROR|CRITICAL) ' "$LOGS/<file>" | tail -30
grep -n -B3 -A40 'Traceback (most recent call last)' "$LOGS/<file>" | tail -80
grep -n -E '\[WARNING ' "$LOGS/<file>" | grep -viE 'telemetry|deprecat' | tail -20
```

Lines look like `2026-10-02T14:03:11 [ERROR   ] <message> key=value [logger]`.
Files can be hundreds of MB — grep/head/tail, never cat. Four retries are four
files: their start times and lengths are the "what they did" trail and the
minutes-lost figures. No log directory → write `logs: unavailable` and use the
terminal output.

**Provider names** — only from these variables, in the environment or by
grepping `.env` for exactly these keys:
`LLM_PROVIDER LLM_MODEL EMBEDDING_PROVIDER EMBEDDING_MODEL GRAPH_DATABASE_PROVIDER VECTOR_DB_PROVIDER DB_PROVIDER`.

**Before calling anything a hang** — a process at 0% CPU holding one open
connection is also what a laptop that went to sleep mid-request looks like
afterwards. Check for a sleep inside the window first:

```bash
pmset -g log | grep -E "Entering Sleep|Wake" | tail -5          # macOS
journalctl --since "-2h" | grep -iE "suspend|resume" | tail -5   # Linux
```

If the machine slept, say so in the entry ("in-flight LLM request never
recovered after the laptop slept at 23:05") and grade it as cognee failing to
recover, not as a hang.

## What never goes in the file

- anything the participant said, quoted or paraphrased in their voice —
  sentiment labels and the cognee trigger only
- keys and tokens (`sk-…`, `AKIA…`, `ghp_…`, anything after key / token /
  secret / password / Authorization), URLs carrying credentials, anything
  else from `.env`
- their data: document text, chunk text, entities, search results, input
  file names. Cut log lines at `text=`, `content=`, `query=`. Repro code uses
  a placeholder.
- people: no names, emails, or handles of the participant, teammates,
  mentors, or companies
- the participant's own code beyond the one cognee call that failed

Mask with `***` if a line is worth keeping otherwise.

## Wrap-up

When they say they're submitting, done, or out of time — or ask for it. Because
of the checkpoints the file is already current; this pass only finishes it:

1. Build the Timeline from the log files; fill `first_working_recall`,
   `minutes_lost_to_cognee`, `outcome`, `mood_trajectory`.
2. Re-read the session since the last checkpoint for anything not yet in the
   file: repeated questions, the moment they changed approach, mood shifts tied
   to cognee.
3. Ask at most two questions, only if the session doesn't already answer them:
   "What was the single most annoying thing about cognee today?" and
   "Would you use it again — yes / unsure / no?" Record the answers as a
   topic and a sentiment, not as a quote.
4. Write the Summary.
5. Tell them, once:

   > I kept a private record of your experience with cognee today in
   > `cognee-feedback.md` (it's in .gitignore). It has the errors, timings,
   > and how things felt along the way — no quotes, no keys, no .env, no
   > data, no names. The cognee team reads every one of these to fix what
   > annoyed you. Have a look, then hand it in the way the organizers
   > announced — ask a mentor if you missed it.

   The organizers tell participants where the file goes; the skill does not
   carry a destination.

Never send it yourself. Never commit it.
