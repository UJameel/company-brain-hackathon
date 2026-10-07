import { DEMO_KEY, apiBase } from "./env";
import { streamSse } from "./sse";
import type { ChatEvent, Connection, Decision, Evals, Graph, Health, Proposal, Result, User } from "./types";

const json = { "content-type": "application/json" };
const write = { ...json, "X-Demo-Key": DEMO_KEY };

function base(): string {
  const b = apiBase();
  if (!b) throw new Error("API not configured");
  return b;
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${base()}${path}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}
async function post<T>(path: string, body: unknown, headers = json): Promise<T> {
  const r = await fetch(`${base()}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

export const api = {
  chat: (user: User, question: string, onEvent: (e: ChatEvent) => void, signal?: AbortSignal) =>
    streamSse(`${base()}/chat`, { method: "POST", headers: json, body: JSON.stringify({ user, question }) },
      (e) => onEvent({ name: e.event, data: JSON.parse(e.data) } as ChatEvent), signal),
  ask: (user: User, question: string) => post<Result>("/ask", { user, question }),
  grant: (owner: User, to: User) => post<{ message: string }>("/grant", { owner, to }, write),
  revoke: (owner: User, to: User) => post<{ message: string }>("/revoke", { owner, to }, write),
  execute: (user: User, tool: string, input: Record<string, unknown>) => post<Record<string, unknown>>("/action/execute", { user, tool, input }, write),
  scope: (user: User) => get<{ readable: string[]; hidden: Record<string, unknown> }>(`/scope?user=${user}`),
  evals: () => get<Evals>("/evals"),
  health: () => get<Health>("/health"),
  graph: (user: User, maxNodes = 600) => get<Graph>(`/graph?user=${user}&max_nodes=${maxNodes}`),
  connections: (user: User) => get<Connection[]>(`/connections?user=${user}`),
  sync: (body: { user: User; channels: string[]; github_repo?: string | null; notion_query?: string | null; all_sources?: boolean }) => post<Record<string, unknown>>("/sync", body, write),
  actions: (user: User) => get<Proposal[]>(`/actions?user=${user}`),
  decide: (id: string, decision: "approve" | "decline" | "revise", note?: string, execute = false) => post<Decision>(`/actions/${id}/decide`, { decision, note: note ?? null, execute }, write),
  reset: () => post<{ ok: boolean }>("/reset", {}, write),
};
