import type { Turn } from "./chat";
import type { Action, Decision } from "./types";

/** `source:github` -> "GitHub". Unknown connectors are capitalised; pantheon's own notes read as past decisions. */
export function sourceName(tag: string): string {
  const key = tag.replace(/^source:/, "");
  const known: Record<string, string> = { github: "GitHub", slack: "Slack", notion: "Notion", pantheon: "past decisions", gmail: "Gmail", linear: "Linear", jira: "Jira", hubspot: "HubSpot" };
  return known[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

const TOOL: Record<string, { noun: string; past: string; infinitive: string }> = {
  slack_send_message: { noun: "a Slack message", past: "sent a Slack message", infinitive: "send a Slack message" },
  github_issue_create: { noun: "a GitHub issue", past: "opened a GitHub issue", infinitive: "open a GitHub issue" },
  request_access: { noun: "an access request", past: "sent an access request", infinitive: "send an access request" },
};
const tool = (t: string) => TOOL[t] ?? { noun: t, past: `ran ${t}`, infinitive: `run ${t}` };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type StepLine = { god: "Hermes" | "Cerberus" | "Athena" | "Hephaestus"; text: string; pending: boolean; dim?: boolean };

function hephaestusText(t: Turn): string | null {
  const d = t.steps.decision as (Decision | { error: string } | undefined);
  if (d) {
    if ("error" in d) return d.error;
    if (d.decision === "approve") {
      const a = d.action; const w = tool(a.tool);
      return a.status === "executed" ? `Approved: ${w.past} as ${a.as_user}` : `Approved (dry run): would ${w.infinitive} as ${a.as_user}`;
    }
    if (d.decision === "decline") return "Declined; the brain remembers that";
    return "Revised the proposal; see the new card";
  }
  const a = t.steps.hephaestus as Action | undefined;
  if (a) {
    const w = tool(a.tool);
    if (a.status === "dry-run") return `Drafted ${w.noun} as ${a.as_user ?? t.user} (dry run)`;
    if (a.status === "refused") return `Refused: ${a.reason ?? a.tool}`;
    return `${cap(w.past)} as ${a.as_user ?? t.user}`;
  }
  const n = t.steps.proposals?.length ?? 0;
  if (n) return `Suggests ${n} follow-up${n > 1 ? "s" : ""}`;
  return null;
}

/** The step rail in plain language. Model names, tokens and cost stay out of these lines. */
export function stepLines(t: Turn): StepLine[] {
  const h = t.steps.hermes;
  const hermes: StepLine = h
    ? { god: "Hermes", pending: false, text: h.intent === "decision" ? `Understood as a decision: ${h.decision ?? "revise"}` : h.intent === "action" ? `Understood as a request to ${tool(h.action_tool ?? "slack_send_message").infinitive}` : "Understood as a question" }
    : { god: "Hermes", pending: !t.done, text: "" };
  const heph = hephaestusText(t);
  if (h?.intent === "decision") {
    return [hermes, { god: "Hephaestus", pending: !heph && !t.done, text: heph ?? "" }];
  }
  const c = t.steps.cerberus;
  const cerberus: StepLine = c
    ? { god: "Cerberus", pending: false, text: `${cap(t.user)} may read ${c.readable.join(", ") || "nothing"}; ${Object.keys(c.hidden).length ? `hidden: ${Object.entries(c.hidden).map(([n, m]) => `${n} (owner ${m.owner})`).join(", ")}` : "nothing hidden"}` }
    : { god: "Cerberus", pending: !t.done, text: "" };
  const r = t.steps.recall;
  const athena: StepLine = r
    ? { god: "Athena", pending: false, text: r.passages === 0 ? "Found nothing readable" : `Found ${r.passages} passage${r.passages > 1 ? "s" : ""} ${r.sources.length > 1 ? "across" : "in"} ${list(r.sources.map(sourceName)) || "the brain"}` }
    : { god: "Athena", pending: !t.done, text: "" };
  const hephaestus: StepLine = heph
    ? { god: "Hephaestus", pending: false, text: heph }
    : { god: "Hephaestus", pending: !t.done && h?.intent === "action", text: t.done ? "Nothing to do" : "", dim: t.done };
  return [hermes, cerberus, athena, hephaestus];
}
