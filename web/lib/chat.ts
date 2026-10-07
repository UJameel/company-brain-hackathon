import type { Action, ChatEvent, HiddenMeta, Proposal, Result, Themis, User } from "./types";

export type Region = "thalamus" | "amygdala" | "hippocampus" | "prefrontal" | "motor" | "orbitofrontal" | "sleep" | null;

export const REGION_FOR_EVENT: Record<ChatEvent["name"], Region> = {
  hermes: "thalamus", cerberus: "amygdala", "athena.recall": "hippocampus", "athena.token": "prefrontal",
  hephaestus: "motor", "hephaestus.proposed": "motor", themis: "orbitofrontal", done: null, error: null,
};

export type Turn = {
  id: string; user: User; question: string; startedAt: number;
  steps: {
    hermes?: { intent: string; action_tool: string | null; model: string };
    cerberus?: { readable: string[]; hidden: Record<string, HiddenMeta> };
    recall?: { passages: number; sources: string[]; model: string };
    hephaestus?: Action;
    proposals?: Proposal[];
    themis?: Themis;
  };
  answer: string; result: Result | null; error: string | null; region: Region; done: boolean;
};

export function newTurn(user: User, question: string): Turn {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, user, question, startedAt: Date.now(), steps: {}, answer: "", result: null, error: null, region: null, done: false };
}

export function applyEvent(turn: Turn, e: ChatEvent): Turn {
  const next: Turn = { ...turn, steps: { ...turn.steps } };
  const region = REGION_FOR_EVENT[e.name];
  if (region) next.region = region;
  switch (e.name) {
    case "hermes": next.steps.hermes = e.data; break;
    case "cerberus": next.steps.cerberus = e.data; break;
    case "athena.recall": next.steps.recall = e.data; break;
    case "athena.token": next.answer = turn.answer + e.data.text; break;
    case "hephaestus": next.steps.hephaestus = e.data; break;
    case "hephaestus.proposed": next.steps.proposals = e.data.proposals; break;
    case "themis": next.steps.themis = e.data; break;
    case "done": next.result = e.data; next.answer = e.data.answer; next.done = true; if (e.data.suggested_actions?.length && !next.steps.proposals) next.steps.proposals = e.data.suggested_actions; break;
    case "error": next.error = e.data.detail; next.done = true; break;
  }
  return next;
}
