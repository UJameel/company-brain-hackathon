#!/bin/sh
# cognee-hackathon-feedback checkpoint hook — registered on the agent's `Stop` event
# (end of every agent turn) by install.sh, for Claude Code (.claude/settings.json) and
# Codex (.codex/hooks.json). Project-scoped: nothing outside the repo is touched.
#
# Neither agent has a timer event, so "every 10 minutes" is a time gate on turns: the
# first turn that ends ≥ INTERVAL seconds after the last checkpoint asks the agent to
# update ./cognee-feedback.md, with a count of cognee errors logged since then (zero
# runs is still a checkpoint — sentiment about cognee does not need a process to have
# run). Every other turn exits silently. Runs in well under 100 ms; never fails the turn.
INTERVAL="${COGNEE_FEEDBACK_INTERVAL:-600}"
STATE="${COGNEE_FEEDBACK_STATE:-.cognee-feedback.state}"
REPORT="cognee-feedback.md"

input="$(cat 2>/dev/null)"
# Loop guard: a turn the agent is already continuing because of this hook ends normally.
# Exact match on the field: the input also carries the agent's whole last message, which
# may contain the word "true" anywhere.
if printf '%s' "$input" | grep -Eq '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then exit 0; fi

now="$(date +%s)"
if [ ! -f "$STATE" ]; then                 # install.sh starts the clock; this is the fallback for a
  printf '%s\n' "$now" > "$STATE"; exit 0  # hand-copied skill: start it now, say nothing
fi
last="$(cat "$STATE" 2>/dev/null || echo 0)"
[ "$((now - last))" -ge "$INTERVAL" ] || exit 0

# Evidence since the last checkpoint: cognee's own log files, one per process run.
LOGS="${COGNEE_LOGS_DIR:-$HOME/.cognee/logs}"; [ -d "$LOGS" ] || LOGS=/tmp/cognee_logs
runs=0; errors=0; types=""
if [ -d "$LOGS" ]; then
  new="$(find "$LOGS" -name '*.log' -newer "$STATE" 2>/dev/null)"
  if [ -n "$new" ]; then
    runs="$(printf '%s\n' "$new" | wc -l | tr -d ' ')"
    # shellcheck disable=SC2086
    errors="$(cat $new | grep -c '\[ERROR' || true)"
    types="$(cat $new | grep -o 'exception_type=[A-Za-z_.]*' | cut -d= -f2 | sort | uniq -c | sort -rn | head -5 | awk '{printf "%s x%s, ", $2, $1}' | sed 's/, $//')"
  fi
fi
# The checkpoint fires on time whether or not cognee ran: how the participant felt about
# cognee in this stretch is worth recording even when nothing was executed.
printf '%s\n' "$now" > "$STATE"

since="$(date -r "$last" +%H:%M 2>/dev/null || date -d "@$last" +%H:%M 2>/dev/null || echo "the last checkpoint")"
if [ -f "$REPORT" ]; then verb="Update"; else verb="Create"; fi
if [ "$errors" -gt 0 ]; then
  evidence="cognee logged $errors error line(s) across $runs run(s) since $since (${types})."
elif [ "$runs" -gt 0 ]; then
  evidence="cognee logged no errors since $since ($runs run(s))."
else
  evidence="no cognee run since $since."
fi
msg="cognee-feedback checkpoint (every ~10 min). $evidence $verb ./$REPORT following the cognee-hackathon-feedback skill: merge each distinct error into an entry (dedupe on exception type + cognee call, bump counts); add one sentiment word for this stretch if cognee came up at all — in conversation, docs, or waiting — even without a run; note anything the user did not understand. Keep it short; if cognee did not come up, change nothing. Then stop."

# Keep the agent working for one short continuation; the reason reaches it as context.
printf '{"decision":"block","reason":"%s"}\n' "$(printf '%s' "$msg" | sed 's/["\\]/\\&/g')"
exit 0
