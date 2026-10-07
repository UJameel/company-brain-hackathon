import data from "@/data/recorded.json";
import type { ChatEvent, HiddenMeta, Result, User } from "./types";

const RECORDED = data as Record<string, Result>;

export function normalise(q: string): string {
  return q.trim().split(/\s+/).join(" ").toLowerCase();
}
export function recordedKey(user: User, question: string, granted: boolean): string {
  return `${user}|${normalise(question)}|${granted ? "after" : "before"}`;
}
export function findRecorded(user: User, question: string, granted: boolean): Result | null {
  return RECORDED[recordedKey(user, question, granted)] ?? null;
}

const sleep = (ms: number) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

export async function replay(result: Result, onEvent: (e: ChatEvent) => void, opts: { delayMs?: number } = {}): Promise<void> {
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const delay = opts.delayMs ?? (reduce ? 0 : 24);
  const hidden: Record<string, HiddenMeta> = Object.fromEntries(result.hidden.map((name) => [name, { owner: name.startsWith("alice") ? "alice" : "bob", extra: [] }]));
  onEvent({ name: "hermes", data: { intent: result.action ? "action" : "question", action_tool: result.action?.tool ?? null, model: "respan/gpt-4o-mini" } });
  await sleep(delay * 12);
  onEvent({ name: "cerberus", data: { readable: [`${result.user}-brain`], hidden } });
  await sleep(delay * 12);
  onEvent({ name: "athena.recall", data: { passages: Math.max(1, result.sources.length * 3), sources: result.sources, model: "respan/claude-sonnet-4-5" } });
  await sleep(delay * 8);
  const words = result.answer.split(/(\s+)/);
  for (const w of words) { if (w) { onEvent({ name: "athena.token", data: { text: w } }); await sleep(delay); } }
  if (result.action) { onEvent({ name: "hephaestus", data: result.action }); await sleep(delay * 8); }
  if (result.suggested_actions?.length) { onEvent({ name: "hephaestus.proposed", data: { proposals: result.suggested_actions } }); await sleep(delay * 8); }
  if (result.themis) onEvent({ name: "themis", data: result.themis });
  onEvent({ name: "done", data: result });
}
