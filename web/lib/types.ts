export type User = "alice" | "bob";
export const USERS: User[] = ["alice", "bob"];
export type UsageRow = { step: string; model: string; provider?: string; fallback?: boolean; prompt_tokens: number | null; completion_tokens: number | null };
export type Action = { tool: string; status: string; as_user?: string; input?: Record<string, unknown>; reason?: string } & Record<string, unknown>;
export type Themis = { scenario_id: string; fact_score: number; hits: string[]; missing: string[]; leaks: string[]; grounded: string[]; ungrounded: string[]; action_ok: boolean };
export type Proposal = { id: string; user: User; as_user: string; tool: string; input: Record<string, unknown>; rationale: string; origin: "suggested" | "requested" | "revised"; status: string; parent: string | null; created_at: string; result?: Record<string, unknown>; note?: string | null };
export type Decision = { decision: "approve" | "decline"; action: Proposal } | { decision: "revise"; superseded: string; proposal: Proposal };
export type Result = { user: User; question: string; answer: string; sources: string[]; hidden: string[]; action: Action | null; suggested_actions?: Proposal[]; usage: UsageRow[]; feed: string[]; latency_s: number; themis: Themis | null; cost_usd: number };
export type HiddenMeta = { owner: string; sources?: string[]; extra?: string[]; tags?: string[]; documents?: number };
export type ChatEvent =
  | { name: "hermes"; data: { intent: string; action_tool: string | null; model: string } }
  | { name: "cerberus"; data: { readable: string[]; hidden: Record<string, HiddenMeta> } }
  | { name: "athena.recall"; data: { passages: number; sources: string[]; model: string } }
  | { name: "athena.token"; data: { text: string; replace?: boolean } }
  | { name: "hephaestus"; data: Action }
  | { name: "hephaestus.proposed"; data: { proposals: Proposal[] } }
  | { name: "themis"; data: Themis }
  | { name: "done"; data: Result }
  | { name: "error"; data: { detail: string } };
export type Grant = { owner: string; grantee: string; dataset: string; permission: string };
export type Health = { ok: boolean; mode: string; users: User[]; grants: Grant[] };
export type EvalRow = { id: string; as_user: User; question: string; answer: string; sources: string[]; hidden: string[]; score: { final: number; missing: string[]; leaks: string[]; ungrounded: string[] }; latency_s: number };
export type Results = { label: string; stage?: string; n: number; mean: number; models: Record<string, string>; rows: EvalRow[] };
export type Evals = { before: Results | null; after: Results | null; isolation: Results | null; change: string };
export type GraphNode = { id: string; label: string; type: string; node_set: string[]; dataset: string | null };
export type GraphEdge = { source: string; target: string; label: string };
export type Graph = { nodes: GraphNode[]; edges: GraphEdge[] };
export type Connection = { connection: string; provider: string | null; status: string | null; adapter: "known" | "generic"; link: string | null };
