# Pantheon Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Next.js app in `web/` with the landing page (3D brain scrollytelling) at `/` and the product at `/app` (streaming chat that lights the brain, compare mode, grant and revoke, action execute, evals, graph view, connections), deployed to Vercel against the Fly API.

**Architecture:** App Router with server components for static sections and client leaves for motion, the brain and the chat. `lib/` holds pure, tested logic: SSE parsing, chat event reduction, brain geometry and camera choreography, recorded-run replay. The brain is one `three` component with four modes. All colours and type come from tokens in `globals.css`.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind v4, `motion`, `three`, `d3-force-3d`, `@phosphor-icons/react`, Vitest, `@playwright/test`, pnpm.

**Spec:** `docs/superpowers/specs/2026-10-07-pantheon-web-design.md` (sections 6, 7.3, 8). API plan: `docs/superpowers/plans/2026-10-07-pantheon-api.md`.

## Global Constraints

- Dark theme locked. Tokens: `--bg #121010 --bg-2 #181514 --bg-3 #201b19 --line #2b2421 --line-2 #3b312b --fg #efe6d8 --fg-2 #c3b6a5 --muted #8a7c6c --accent #c8602c --accent-hi #e8843f --accent-dim rgba(200,96,44,.16) --accent-ink #1c0d05`. Radius 2px everywhere.
- Fonts: Cormorant Garamond (500, 600, italic 500) for display and names; Geist for body; Geist Mono for data. All via `next/font/google`.
- Icons: `@phosphor-icons/react` only, `weight="light"` (1.5 stroke equivalent). No hand-rolled SVG icons.
- Zero em-dashes or en-dashes in visible copy. At most two eyebrows on the landing page (hero, pantheon).
- The accent means lit, readable, granted. Hidden or inactive is neutral. Failed fact check is muted.
- Reduced motion: every animation collapses to instant under `prefers-reduced-motion`. No `window.addEventListener("scroll")`; observers and Motion `useScroll` only.
- Source tags are generic `source:<connector>`; never assume slack, github, notion are the only values. Colour-by-source assigns tones by first appearance.
- Mnemosyne copy: "every system of record your company lives in, pulled as you, through 400+ Scalekit connectors; the more you connect, the better the brain." Hephaestus copy: "acts on request, proposes follow-ups; you approve, decline or revise, and it remembers your decisions."
- Proposals (backend `b27a51b`): every answer may carry `suggested_actions`; the user approves, declines or revises each one. Decisions go through `POST /actions/{id}/decide`. Pending proposals list at `GET /actions?user=`.
- Connections come from discovery (`{connection, provider, status, adapter, link}`), any connector, possibly none for Bob.
- Env: `NEXT_PUBLIC_PANTHEON_API` (no trailing slash), `NEXT_PUBLIC_DEMO_KEY`.
- Commands run from `/Users/usmanjameel/company-brain-hackathon/.claude/worktrees/web/web` with pnpm 10. Node 25 is installed.
- Hero fits 1440x900 and 390 wide without scrolling to the CTA; no horizontal page scroll at any width.

## Review Focus

1. The API is down or `NEXT_PUBLIC_PANTHEON_API` is unset: `/app` must switch to recorded mode with a visible pill, not a blank screen. Test in Task 5 (unit) and Task 12 (e2e).
2. An SSE `error` event mid-turn: the turn shows the detail inline and the composer re-enables. Test in Task 3.
3. A question with no recorded entry in recorded mode: the turn says "No recorded answer for this question" rather than throwing. Test in Task 4.
4. WebGL unavailable (headless, old GPU): the brain falls back to the 2D canvas and the page stays usable. Test in Task 9 (unit on `hasWebGL`) and Task 12 (the phone e2e project runs headless Chromium, where the fallback path renders).
5. The hidden card with more than one hidden dataset, or a dataset whose `extra` is empty: list every dataset, show "sources" when `extra` is missing, never render an empty line. Test in Task 6.

---

### Task 1: Scaffold, tokens, fonts

**Files:**
- Create: `web/` via create-next-app, then `web/app/globals.css`, `web/app/layout.tsx`, `web/vitest.config.ts`, `web/lib/env.ts`
- Test: `web/lib/env.test.ts`

**Interfaces:**
- Produces: `API_BASE: string | null` and `DEMO_KEY: string` from `lib/env.ts`; CSS variables and Tailwind colour names `bg, bg-2, bg-3, line, line-2, fg, fg-2, muted, accent, accent-hi, accent-dim, accent-ink`; font CSS variables `--font-serif, --font-sans, --font-mono`.

- [ ] **Step 1: Scaffold**

```bash
cd /Users/usmanjameel/company-brain-hackathon/.claude/worktrees/web
pnpm dlx create-next-app@15 web --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-pnpm --skip-install
cd web
pnpm add motion three d3-force-3d @phosphor-icons/react
pnpm add -D @types/three @types/d3-force-3d vitest @vitejs/plugin-react jsdom @playwright/test
```

Confirm `package.json` lists `next` at `15.x` and `tailwindcss` at `^4`. If create-next-app produced Tailwind v3 (a `tailwind.config.ts` exists), run `pnpm add -D tailwindcss@4 @tailwindcss/postcss@4` and replace `postcss.config.mjs` with `export default { plugins: { "@tailwindcss/postcss": {} } }`.

- [ ] **Step 2: Write the failing test for env**

```ts
// web/lib/env.test.ts
import { describe, expect, it, vi } from "vitest";

describe("env", () => {
  it("returns null API_BASE when unset and strips a trailing slash when set", async () => {
    vi.stubEnv("NEXT_PUBLIC_PANTHEON_API", "");
    let mod = await import("./env");
    expect(mod.apiBase()).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_PANTHEON_API", "https://pantheon-api.fly.dev/");
    mod = await import("./env");
    expect(mod.apiBase()).toBe("https://pantheon-api.fly.dev");
  });
});
```

```ts
// web/vitest.config.ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", include: ["lib/**/*.test.ts", "lib/**/*.test.tsx"] },
  resolve: { alias: { "@": __dirname } },
});
```

Add to `package.json` scripts: `"test": "vitest run"`, `"e2e": "playwright test"`.

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL, cannot resolve `./env`

- [ ] **Step 4: Write env, tokens and layout**

```ts
// web/lib/env.ts
export function apiBase(): string | null {
  const v = process.env.NEXT_PUBLIC_PANTHEON_API?.trim();
  return v ? v.replace(/\/+$/, "") : null;
}
export const DEMO_KEY = process.env.NEXT_PUBLIC_DEMO_KEY ?? "";
```

```css
/* web/app/globals.css */
@import "tailwindcss";

/* Pantheon tokens. Dark theme locked. One accent: burnt orange, the colour of a lit region. */
:root {
  --bg: #121010; --bg-2: #181514; --bg-3: #201b19; --line: #2b2421; --line-2: #3b312b;
  --fg: #efe6d8; --fg-2: #c3b6a5; --muted: #8a7c6c;
  --accent: #c8602c; --accent-hi: #e8843f; --accent-dim: rgba(200, 96, 44, 0.16); --accent-ink: #1c0d05;
  color-scheme: dark;
}
@theme inline {
  --color-bg: var(--bg); --color-bg-2: var(--bg-2); --color-bg-3: var(--bg-3);
  --color-line: var(--line); --color-line-2: var(--line-2);
  --color-fg: var(--fg); --color-fg-2: var(--fg-2); --color-muted: var(--muted);
  --color-accent: var(--accent); --color-accent-hi: var(--accent-hi); --color-accent-dim: var(--accent-dim); --color-accent-ink: var(--accent-ink);
  --font-serif: var(--font-cormorant), Georgia, serif;
  --font-sans: var(--font-geist), system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, monospace;
  --radius: 2px;
}
html, body { background: var(--bg); color: var(--fg); }
body { font-family: var(--font-sans); -webkit-font-smoothing: antialiased; }
h1, h2, h3 { font-family: var(--font-serif); font-weight: 500; line-height: 1.05; text-wrap: balance; }
.insc { font-family: var(--font-serif); font-weight: 600; text-transform: uppercase; letter-spacing: 0.22em; font-size: 13px; color: var(--accent); }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 44px; padding: 0 20px; border-radius: 2px;
  font-weight: 500; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap; border: 1px solid var(--line-2); color: var(--fg);
  transition: transform 0.15s, background 0.2s, border-color 0.2s; }
.btn:hover { border-color: var(--fg-2); } .btn:active { transform: translateY(1px); }
.btn-primary { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); }
.btn-primary:hover { background: var(--accent-hi); border-color: var(--accent-hi); }
.btn-sm { height: 36px; padding: 0 14px; font-size: 12px; }
.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
```

```tsx
// web/app/layout.tsx
import type { Metadata } from "next";
import { Cormorant_Garamond, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600"], style: ["normal", "italic"], variable: "--font-cormorant" });
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Pantheon",
  description: "A company brain that only tells you what you may know.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${geist.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

Delete the scaffold's `app/page.tsx` content and replace with a placeholder-free page for now:

```tsx
// web/app/page.tsx
export default function Home() {
  return <main className="px-6 py-24"><h1 className="text-5xl">Pantheon</h1></main>;
}
```

- [ ] **Step 5: Run tests and dev server**

Run: `pnpm test` then `pnpm dev` and open `http://localhost:3000`.
Expected: 1 passed; the page renders a serif "Pantheon" on the dark ground with no console errors.

- [ ] **Step 6: Commit**

```bash
git add web
git commit -m "web: Next.js scaffold with Pantheon tokens and fonts"
```

---

### Task 2: API types and SSE client

**Files:**
- Create: `web/lib/types.ts`, `web/lib/sse.ts`, `web/lib/api.ts`
- Test: `web/lib/sse.test.ts`

**Interfaces:**
- Produces (types): `User = "alice" | "bob"`; `UsageRow {step, model, prompt_tokens: number|null, completion_tokens: number|null}`; `Action {tool, status, as_user?, input?, reason?} & Record<string, unknown>`; `Themis {scenario_id, fact_score, hits, missing, leaks, grounded, ungrounded, action_ok}`; `Result {user, question, answer, sources: string[], hidden: string[], action: Action|null, usage: UsageRow[], feed: string[], latency_s, themis: Themis|null, cost_usd}`; `HiddenMeta {owner, sources?: string[], extra?: string[], tags?: string[], documents?: number}`; `ChatEvent = {name: "hermes", data: {intent, action_tool, model}} | {name: "cerberus", data: {readable: string[], hidden: Record<string, HiddenMeta>}} | {name: "athena.recall", data: {passages, sources: string[], model}} | {name: "athena.token", data: {text}} | {name: "hephaestus", data: Action} | {name: "themis", data: Themis} | {name: "done", data: Result} | {name: "error", data: {detail}}`.
- Produces (sse): `parseSseChunk(buffer: string): {events: {event: string, data: string}[], rest: string}`; `streamSse(url, init, onEvent: (e: {event: string, data: string}) => void, signal?)`.
- Produces (api): `chat(user, question, onEvent, signal)`, `ask(user, question) -> Result`, `grant(owner, to)`, `revoke(owner, to)`, `execute(user, tool, input)`, `scope(user)`, `evals()`, `health()`, `graph(user)`, `connections(user)`, `sync(body)`, `reset()`. Every write sends `X-Demo-Key`.

- [ ] **Step 1: Write the failing test**

```ts
// web/lib/sse.test.ts
import { describe, expect, it } from "vitest";
import { parseSseChunk } from "./sse";

describe("parseSseChunk", () => {
  it("splits complete frames and keeps the partial tail", () => {
    const buf = 'event: hermes\ndata: {"intent":"question"}\n\nevent: athena.token\ndata: {"text":"The"}\n\nevent: done\ndata: {"ans';
    const { events, rest } = parseSseChunk(buf);
    expect(events).toEqual([
      { event: "hermes", data: '{"intent":"question"}' },
      { event: "athena.token", data: '{"text":"The"}' },
    ]);
    expect(rest).toBe('event: done\ndata: {"ans');
  });
  it("handles CRLF and multi-line data", () => {
    const { events } = parseSseChunk("event: x\r\ndata: a\r\ndata: b\r\n\r\n");
    expect(events).toEqual([{ event: "x", data: "a\nb" }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL, cannot resolve `./sse`

- [ ] **Step 3: Write the implementation**

```ts
// web/lib/sse.ts
export type RawEvent = { event: string; data: string };

export function parseSseChunk(buffer: string): { events: RawEvent[]; rest: string } {
  const norm = buffer.replace(/\r\n/g, "\n");
  const frames = norm.split("\n\n");
  const rest = frames.pop() ?? "";
  const events: RawEvent[] = [];
  for (const frame of frames) {
    let event = "message";
    const data: string[] = [];
    for (const line of frame.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    }
    if (data.length) events.push({ event, data: data.join("\n") });
  }
  return { events, rest };
}

export async function streamSse(url: string, init: RequestInit, onEvent: (e: RawEvent) => void, signal?: AbortSignal): Promise<void> {
  const res = await fetch(url, { ...init, signal, headers: { accept: "text/event-stream", ...(init.headers ?? {}) } });
  if (!res.ok || !res.body) throw new Error(`${res.status} ${res.statusText}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { events, rest } = parseSseChunk(buffer);
    buffer = rest;
    events.forEach(onEvent);
  }
  const tail = parseSseChunk(buffer + "\n\n");
  tail.events.forEach(onEvent);
}
```

```ts
// web/lib/types.ts
export type User = "alice" | "bob";
export const USERS: User[] = ["alice", "bob"];
export type UsageRow = { step: string; model: string; prompt_tokens: number | null; completion_tokens: number | null };
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
  | { name: "athena.token"; data: { text: string } }
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
```

```ts
// web/lib/api.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add web/lib
git commit -m "web: API types and SSE client"
```

---

### Task 3: Chat turn reducer

**Files:**
- Create: `web/lib/chat.ts`
- Test: `web/lib/chat.test.ts`

**Interfaces:**
- Produces: `Region = "thalamus" | "amygdala" | "hippocampus" | "prefrontal" | "motor" | "orbitofrontal" | "sleep" | null`; `Turn {id, user, question, startedAt, steps: {hermes?, cerberus?, recall?, hephaestus?, themis?}, answer: string, result: Result | null, error: string | null, region: Region, done: boolean}`; `newTurn(user, question) -> Turn`; `applyEvent(turn, event) -> Turn` (pure, returns a new object); `REGION_FOR_EVENT: Record<ChatEvent["name"], Region>`.

- [ ] **Step 1: Write the failing test**

```ts
// web/lib/chat.test.ts
import { describe, expect, it } from "vitest";
import { applyEvent, newTurn } from "./chat";
import type { Result } from "./types";

const done: Result = { user: "bob", question: "Q", answer: "A", sources: ["source:slack"], hidden: ["alice-brain"], action: null, usage: [], feed: [], latency_s: 1, themis: null, cost_usd: 0 };

describe("applyEvent", () => {
  it("accumulates tokens and lights regions in order", () => {
    let t = newTurn("bob", "Q");
    t = applyEvent(t, { name: "hermes", data: { intent: "question", action_tool: null, model: "gpt-4o-mini" } });
    expect(t.region).toBe("thalamus");
    t = applyEvent(t, { name: "cerberus", data: { readable: ["bob-brain"], hidden: { "alice-brain": { owner: "alice", extra: ["channel:leadership"] } } } });
    expect(t.region).toBe("amygdala");
    t = applyEvent(t, { name: "athena.recall", data: { passages: 3, sources: ["source:slack"], model: "claude-sonnet-4-5" } });
    expect(t.region).toBe("hippocampus");
    t = applyEvent(t, { name: "athena.token", data: { text: "The " } });
    t = applyEvent(t, { name: "athena.token", data: { text: "end." } });
    expect(t.answer).toBe("The end.");
    expect(t.region).toBe("prefrontal");
    t = applyEvent(t, { name: "done", data: done });
    expect(t.done).toBe(true);
    expect(t.result?.hidden).toEqual(["alice-brain"]);
    expect(t.steps.cerberus?.hidden["alice-brain"].owner).toBe("alice");
  });
  it("records an error and ends the turn", () => {
    const t = applyEvent(newTurn("alice", "Q"), { name: "error", data: { detail: "gateway closed" } });
    expect(t.error).toBe("gateway closed");
    expect(t.done).toBe(true);
  });
  it("keeps proposals from the stream, or takes them from done", () => {
    const p = { id: "a1", user: "bob" as const, as_user: "bob@northwind.dev", tool: "request_access", input: {}, rationale: "r", origin: "suggested" as const, status: "proposed", parent: null, created_at: "t" };
    const streamed = applyEvent(newTurn("bob", "Q"), { name: "hephaestus.proposed", data: { proposals: [p] } });
    expect(streamed.region).toBe("motor");
    expect(streamed.steps.proposals).toEqual([p]);
    const viaDone = applyEvent(newTurn("bob", "Q"), { name: "done", data: { ...done, suggested_actions: [p] } });
    expect(viaDone.steps.proposals).toEqual([p]);
  });
  it("does not mutate the previous turn", () => {
    const a = newTurn("alice", "Q");
    const b = applyEvent(a, { name: "athena.token", data: { text: "x" } });
    expect(a.answer).toBe("");
    expect(b.answer).toBe("x");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL, cannot resolve `./chat`

- [ ] **Step 3: Write the implementation**

```ts
// web/lib/chat.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
git add web/lib/chat.ts web/lib/chat.test.ts
git commit -m "web: chat turn reducer with region mapping"
```

---

### Task 4: Recorded run and replay

**Files:**
- Create: `web/scripts/record.mjs`, `web/data/recorded.json`, `web/lib/recorded.ts`
- Test: `web/lib/recorded.test.ts`

**Interfaces:**
- Produces: `recordedKey(user, question, granted) -> string` (`${user}|${normalised question}|${before|after}`); `findRecorded(user, question, granted) -> Result | null`; `replay(result, onEvent, opts?: {delayMs?: number}) -> Promise<void>` that emits `hermes`, `cerberus` (hidden built from `result.hidden` with `owner: "alice"` when the name starts with `alice`, else `"bob"`), `athena.recall`, one `athena.token` per word (default 24 ms apart, 0 under reduced motion or when `delayMs` is 0), `hephaestus` when `action`, `themis` when present, then `done`.
- `web/data/recorded.json` shape: `Record<string, Result>` keyed by `recordedKey`.

- [ ] **Step 1: Write the failing test**

```ts
// web/lib/recorded.test.ts
import { describe, expect, it } from "vitest";
import { findRecorded, recordedKey, replay } from "./recorded";
import type { ChatEvent, Result } from "./types";

const r: Result = { user: "bob", question: "What will the Pro plan cost after the Atlas launch?", answer: "Pro is $49.", sources: ["source:slack"], hidden: ["alice-brain"], action: null, usage: [], feed: [], latency_s: 1, themis: null, cost_usd: 0 };

describe("recorded", () => {
  it("keys are case and whitespace insensitive", () => {
    expect(recordedKey("bob", "  what WILL the pro plan cost after the atlas launch?", false)).toBe("bob|what will the pro plan cost after the atlas launch?|before");
  });
  it("returns null for an unknown question", () => {
    expect(findRecorded("bob", "Who is on call?", false)).toBeNull();
  });
  it("replays a result as the ordered event stream", async () => {
    const names: string[] = [];
    let answer = "";
    await replay(r, (e: ChatEvent) => { names.push(e.name); if (e.name === "athena.token") answer += e.data.text; }, { delayMs: 0 });
    expect(names[0]).toBe("hermes"); expect(names[1]).toBe("cerberus"); expect(names[2]).toBe("athena.recall");
    expect(names.at(-1)).toBe("done"); expect(names).not.toContain("hephaestus");
    expect(answer).toBe("Pro is $49.");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL, cannot resolve `./recorded`

- [ ] **Step 3: Write the implementation and the recording script**

```ts
// web/lib/recorded.ts
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
  onEvent({ name: "hermes", data: { intent: result.action ? "action" : "question", action_tool: result.action?.tool ?? null, model: "gpt-4o-mini" } });
  await sleep(delay * 12);
  onEvent({ name: "cerberus", data: { readable: [`${result.user}-brain`], hidden } });
  await sleep(delay * 12);
  onEvent({ name: "athena.recall", data: { passages: Math.max(1, result.sources.length * 3), sources: result.sources, model: "claude-sonnet-4-5" } });
  await sleep(delay * 8);
  const words = result.answer.split(/(\s+)/);
  for (const w of words) { if (w) { onEvent({ name: "athena.token", data: { text: w } }); await sleep(delay); } }
  if (result.action) { onEvent({ name: "hephaestus", data: result.action }); await sleep(delay * 8); }
  if (result.themis) onEvent({ name: "themis", data: result.themis });
  onEvent({ name: "done", data: result });
}
```

```js
// web/scripts/record.mjs
// Captures real /ask responses for the demo questions, both users, before and after the grant.
// Usage: API=http://localhost:8080 DEMO_KEY=dev node scripts/record.mjs
import { writeFileSync } from "node:fs";

const API = process.env.API ?? "http://localhost:8080";
const KEY = process.env.DEMO_KEY ?? "";
const QUESTIONS = [
  "What is blocking PR #3, who owns it, and which issue tracks the blocker?",
  "What will the Pro plan cost after the Atlas launch?",
  "Is the Atlas launch date at risk? If so, what is the fallback date and the deadline that decides it?",
  "Open a GitHub issue asking Marco to add exponential backoff to the Paddle webhook handler so PR #3 can merge.",
];
const norm = (q) => q.trim().split(/\s+/).join(" ").toLowerCase();
const post = (p, b, h = {}) => fetch(`${API}${p}`, { method: "POST", headers: { "content-type": "application/json", ...h }, body: JSON.stringify(b) }).then((r) => r.json());

const out = {};
for (const granted of [false, true]) {
  if (granted) await post("/grant", { owner: "alice", to: "bob" }, { "X-Demo-Key": KEY });
  for (const user of ["alice", "bob"]) for (const q of QUESTIONS) {
    out[`${user}|${norm(q)}|${granted ? "after" : "before"}`] = await post("/ask", { user, question: q });
    console.log(user, granted ? "after" : "before", q.slice(0, 40));
  }
}
await post("/revoke", { owner: "alice", to: "bob" }, { "X-Demo-Key": KEY });
writeFileSync(new URL("../data/recorded.json", import.meta.url), JSON.stringify(out, null, 2));
```

Until the API is up, create `web/data/recorded.json` by hand with the four Bob and Alice "before" entries taken from the rows in `evals/results-before-coverage.json` and the "after" entries from `evals/results-after.json` (both have `answer`, `sources`, `hidden`; set `action: null`, `usage: []`, `feed: []`, `themis: null`, `cost_usd: 0`, and copy `latency_s`). Note the eval questions use PR #42 while the live demo uses PR #3; use the eval wording for the hand-made file and rerun `record.mjs` once the API is live.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: 10 passed

- [ ] **Step 5: Commit**

```bash
git add web/lib/recorded.ts web/lib/recorded.test.ts web/scripts/record.mjs web/data/recorded.json
git commit -m "web: recorded run with replay and capture script"
```

---

### Task 5: App shell and mode detection

**Files:**
- Create: `web/app/app/layout.tsx`, `web/components/app/Rail.tsx`, `web/components/app/UserSwitch.tsx`, `web/components/app/TopBar.tsx`, `web/lib/session.tsx`
- Test: `web/lib/session.test.tsx`

**Interfaces:**
- Produces: `SessionProvider` and `useSession()` returning `{user, setUser, mode: "live" | "recorded" | "checking", grants: Grant[], refresh(): Promise<void>, granted(user): boolean, region: Region, setRegion(r)}`. Mode resolution: `apiBase()` null → `recorded`; else `api.health()` ok → `live`, failure → `recorded`. `granted(u)` is true when any grant has `grantee === u`.
- Routes under the shell: `/app` (chat), `/app/actions`, `/app/graph`, `/app/connections`, `/app/evals`.

- [ ] **Step 1: Write the failing test**

```tsx
// web/lib/session.test.tsx
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./env", () => ({ apiBase: () => "http://api", DEMO_KEY: "k" }));
vi.mock("./api", () => ({ api: { health: vi.fn() } }));

import { api } from "./api";
import { SessionProvider, useSession } from "./session";

function Probe() { const s = useSession(); return <div>{s.mode}:{String(s.granted("bob"))}</div>; }

describe("session", () => {
  it("is live when health answers and reads grants", async () => {
    (api.health as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, mode: "live", users: ["alice", "bob"], grants: [{ owner: "alice", grantee: "bob", dataset: "alice-brain", permission: "read" }] });
    await act(async () => { render(<SessionProvider><Probe /></SessionProvider>); });
    expect(screen.getByText("live:true")).toBeTruthy();
  });
  it("falls back to recorded when health fails", async () => {
    (api.health as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("down"));
    await act(async () => { render(<SessionProvider><Probe /></SessionProvider>); });
    expect(screen.getByText("recorded:false")).toBeTruthy();
  });
});
```

Install the testing library: `pnpm add -D @testing-library/react`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL, cannot resolve `./session`

- [ ] **Step 3: Write the provider and shell**

```tsx
// web/lib/session.tsx
"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { Region } from "./chat";
import { apiBase } from "./env";
import type { Grant, User } from "./types";

type Mode = "live" | "recorded" | "checking";
type Session = { user: User; setUser: (u: User) => void; mode: Mode; grants: Grant[]; refresh: () => Promise<void>; granted: (u: User) => boolean; region: Region; setRegion: (r: Region) => void };
const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>("alice");
  const [mode, setMode] = useState<Mode>("checking");
  const [grants, setGrants] = useState<Grant[]>([]);
  const [region, setRegion] = useState<Region>(null);
  const refresh = useCallback(async () => {
    if (!apiBase()) { setMode("recorded"); return; }
    try { const h = await api.health(); setGrants(h.grants ?? []); setMode(h.ok ? "live" : "recorded"); }
    catch { setMode("recorded"); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const value = useMemo<Session>(() => ({
    user, setUser, mode, grants, refresh, region, setRegion,
    granted: (u) => grants.some((g) => g.grantee === u),
  }), [user, mode, grants, refresh, region]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSession outside SessionProvider");
  return s;
}
```

```tsx
// web/components/app/Rail.tsx
"use client";
import { ChatCircleText, Graph, Hammer, PlugsConnected, Scales } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserSwitch } from "./UserSwitch";

const ITEMS = [
  { href: "/app", label: "Chat", Icon: ChatCircleText },
  { href: "/app/actions", label: "Actions", Icon: Hammer },
  { href: "/app/graph", label: "Graph", Icon: Graph },
  { href: "/app/connections", label: "Connections", Icon: PlugsConnected },
  { href: "/app/evals", label: "Evals", Icon: Scales },
];

export function Rail() {
  const path = usePathname();
  return (
    <nav className="flex h-full w-56 shrink-0 flex-col border-r border-line bg-bg-2">
      <Link href="/" className="flex h-[72px] items-center gap-3 border-b border-line px-5 font-serif text-xl font-semibold uppercase tracking-[0.06em]">
        <span className="relative inline-block h-6 w-6 rounded-full border border-accent after:absolute after:inset-[6px] after:rounded-full after:bg-accent" />Pantheon
      </Link>
      <ul className="flex flex-col gap-1 p-3">
        {ITEMS.map(({ href, label, Icon }) => {
          const on = path === href;
          return (
            <li key={href}>
              <Link href={href} className={`flex items-center gap-3 rounded-[2px] px-3 py-2 text-sm ${on ? "bg-accent-dim text-fg" : "text-fg-2 hover:text-fg"}`}>
                <Icon size={18} weight="light" className={on ? "text-accent" : ""} />{label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto border-t border-line p-3"><UserSwitch /></div>
    </nav>
  );
}
```

```tsx
// web/components/app/UserSwitch.tsx
"use client";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { USERS, type User } from "@/lib/types";

const ROLE: Record<User, string> = { alice: "Eng lead", bob: "Contractor" };

export function UserSwitch() {
  const s = useSession();
  const revoke = async () => { await api.revoke("alice", "bob"); await s.refresh(); };
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Asking as</span>
      <div className="grid grid-cols-2 gap-1">
        {USERS.map((u) => (
          <button key={u} id={`user-${u}`} onClick={() => s.setUser(u)}
            className={`rounded-[2px] border px-2 py-2 text-left ${s.user === u ? "border-accent text-fg" : "border-line-2 text-fg-2"}`}>
            <div className="font-serif text-lg font-semibold capitalize">{u}</div>
            <div className="font-mono text-[11px] text-muted">{ROLE[u]}</div>
          </button>
        ))}
      </div>
      {s.granted("bob") && (
        <div className="flex items-center justify-between font-mono text-[11px] text-accent">
          <span>alice shared with bob</span>
          {s.mode === "live" && <button onClick={revoke} className="text-muted underline-offset-2 hover:underline">Revoke</button>}
        </div>
      )}
    </div>
  );
}
```

```tsx
// web/components/app/TopBar.tsx
"use client";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useState } from "react";

export function TopBar() {
  const s = useSession();
  const [restarting, setRestarting] = useState(false);
  const reset = async () => {
    setRestarting(true);
    try { await api.reset(); } catch { /* the process exits before answering */ }
    const until = Date.now() + 30_000;
    while (Date.now() < until) { await new Promise((r) => setTimeout(r, 1500)); try { await api.health(); break; } catch { /* retry */ } }
    await s.refresh(); setRestarting(false);
  };
  return (
    <header className="flex h-[72px] items-center justify-between border-b border-line px-6">
      <div className="font-mono text-[12px] text-muted">Northwind Labs</div>
      <div className="flex items-center gap-2 font-mono text-[11px]">
        {["Scalekit", "Cognee", "Respan"].map((l) => <span key={l} className="border border-line-2 px-2 py-1 text-fg-2">{l}</span>)}
        <span className={`border px-2 py-1 ${s.mode === "live" ? "border-accent text-accent" : "border-line-2 text-muted"}`}>{s.mode}</span>
        {s.mode === "live" && <button onClick={reset} disabled={restarting} className="btn btn-sm">{restarting ? "Restarting" : "Reset"}</button>}
      </div>
    </header>
  );
}
```

```tsx
// web/app/app/layout.tsx
import { Rail } from "@/components/app/Rail";
import { TopBar } from "@/components/app/TopBar";
import { SessionProvider } from "@/lib/session";
import dynamic from "next/dynamic";

const BrainPanel = dynamic(() => import("@/components/app/BrainPanel").then((m) => m.BrainPanel), { ssr: false });

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="flex h-dvh overflow-hidden">
        <Rail />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <div className="flex min-h-0 flex-1">
            <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
            <aside className="hidden w-[40%] max-w-[640px] border-l border-line lg:block"><BrainPanel /></aside>
          </div>
        </div>
      </div>
    </SessionProvider>
  );
}
```

`BrainPanel` is created in Task 8. Until then, create a stub that renders the label only:

```tsx
// web/components/app/BrainPanel.tsx
"use client";
import { useSession } from "@/lib/session";
export function BrainPanel() {
  const { region } = useSession();
  return <div className="flex h-full items-center justify-center font-mono text-[12px] text-muted">{region ?? "idle"}</div>;
}
```

- [ ] **Step 4: Run tests and the dev server**

Run: `pnpm test` then `pnpm dev` and open `http://localhost:3000/app` with no env set.
Expected: 12 passed; the shell renders with the rail, the top bar showing "recorded", and the empty main.

- [ ] **Step 5: Commit**

```bash
git add web/app/app web/components/app web/lib/session.tsx web/lib/session.test.tsx web/package.json web/pnpm-lock.yaml
git commit -m "web: app shell, session provider, user switch, mode detection"
```

---

### Task 6: Chat page

**Files:**
- Create: `web/app/app/page.tsx`, `web/components/chat/Chat.tsx`, `web/components/chat/Composer.tsx`, `web/components/chat/TurnView.tsx`, `web/components/chat/StepRail.tsx`, `web/components/chat/HiddenCard.tsx`, `web/components/chat/ActionCard.tsx`, `web/components/chat/ProposalCard.tsx`, `web/components/chat/UsageFooter.tsx`, `web/lib/highlight.ts`
- Test: `web/lib/highlight.test.ts`, `web/components/chat/HiddenCard.test.tsx`

**Interfaces:**
- Consumes: `useSession`, `api.chat`, `api.ask`, `api.grant`, `api.execute`, `newTurn`, `applyEvent`, `findRecorded`, `replay`.
- Produces: `highlight(answer: string, terms: string[]) -> Array<{text: string, hit: boolean}>` (case-insensitive, longest term first, no overlaps); `<HiddenCard hidden={Record<string, HiddenMeta>} user={User} onGranted={() => void} />`; `<ProposalCard proposal={Proposal} onChange={(next: Proposal | null) => void} />` with Approve, Decline and Revise (a note field) that call `api.decide`; `<Chat />` owning `turns: Turn[]`, `compare: boolean`, a running flag, and the scenario chips.

- [ ] **Step 1: Write the failing tests**

```ts
// web/lib/highlight.test.ts
import { describe, expect, it } from "vitest";
import { highlight } from "./highlight";

describe("highlight", () => {
  it("marks terms case-insensitively without overlaps", () => {
    const parts = highlight("Pro moves to $59 on October 21. Priya owns it.", ["$59", "october 21", "Priya"]);
    expect(parts.filter((p) => p.hit).map((p) => p.text)).toEqual(["$59", "October 21", "Priya"]);
    expect(parts.map((p) => p.text).join("")).toBe("Pro moves to $59 on October 21. Priya owns it.");
  });
  it("returns the whole text unmarked when there are no terms", () => {
    expect(highlight("hello", [])).toEqual([{ text: "hello", hit: false }]);
  });
});
```

```tsx
// web/components/chat/HiddenCard.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({ useSession: () => ({ mode: "live", refresh: async () => {}, granted: () => false }) }));
vi.mock("@/lib/api", () => ({ api: { grant: vi.fn() } }));

import { HiddenCard } from "./HiddenCard";

describe("HiddenCard", () => {
  it("lists every hidden dataset and falls back to sources when extra is missing", () => {
    render(<HiddenCard user="bob" onGranted={() => {}} hidden={{
      "alice-brain": { owner: "alice", extra: ["channel:leadership", "source:github"] },
      "carol-brain": { owner: "carol", sources: ["source:notion"] },
    }} />);
    expect(screen.getByText("2 datasets you can't see")).toBeTruthy();
    expect(screen.getByText(/channel:leadership, source:github/)).toBeTruthy();
    expect(screen.getByText(/source:notion/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /grant as alice/i })).toBeTruthy();
  });
});
```

Add to `vitest.config.ts` include: `"components/**/*.test.tsx"`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test`
Expected: FAIL, cannot resolve `./highlight` and `./HiddenCard`

- [ ] **Step 3: Write the implementation**

```ts
// web/lib/highlight.ts
export type Part = { text: string; hit: boolean };

export function highlight(text: string, terms: string[]): Part[] {
  const clean = terms.filter(Boolean).sort((a, b) => b.length - a.length);
  if (!clean.length || !text) return [{ text, hit: false }];
  const re = new RegExp(clean.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "gi");
  const parts: Part[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) parts.push({ text: text.slice(last, m.index), hit: false });
    parts.push({ text: m[0], hit: true });
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), hit: false });
  return parts;
}
```

```tsx
// web/components/chat/HiddenCard.tsx
"use client";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { HiddenMeta, User } from "@/lib/types";
import { useState } from "react";

export function HiddenCard({ hidden, user, onGranted }: { hidden: Record<string, HiddenMeta>; user: User; onGranted: () => void }) {
  const s = useSession();
  const [busy, setBusy] = useState(false);
  const names = Object.keys(hidden);
  if (!names.length) return null;
  const owner = (hidden[names[0]].owner || "alice") as User;
  const grant = async () => { setBusy(true); try { await api.grant(owner, user); await s.refresh(); onGranted(); } finally { setBusy(false); } };
  return (
    <div className="mt-3 flex items-center justify-between gap-3 border border-dashed border-line-2 px-3 py-2 text-[12.5px]">
      <div className="text-fg-2">
        <b className="font-medium text-fg">{names.length} dataset{names.length > 1 ? "s" : ""} you can&apos;t see</b>
        {names.map((n) => {
          const m = hidden[n]; const what = (m.extra?.length ? m.extra : m.sources) ?? [];
          return <div key={n} className="font-mono text-[11px]">{n} · owner {m.owner}{what.length ? ` · ${what.join(", ")}` : ""}</div>;
        })}
      </div>
      {s.mode === "live" && user !== owner && (
        <button onClick={grant} disabled={busy} className="btn btn-sm btn-primary">{busy ? "Granting" : `Grant as ${owner}`}</button>
      )}
    </div>
  );
}
```

```tsx
// web/components/chat/StepRail.tsx
import type { Turn } from "@/lib/chat";

const STEPS = [
  { key: "hermes", god: "Hermes", text: (t: Turn) => t.steps.hermes && `routed: ${t.steps.hermes.intent} via ${t.steps.hermes.model}` },
  { key: "cerberus", god: "Cerberus", text: (t: Turn) => t.steps.cerberus && `may read ${t.steps.cerberus.readable.join(", ")}; hidden ${Object.keys(t.steps.cerberus.hidden).join(", ") || "none"}` },
  { key: "athena", god: "Athena", text: (t: Turn) => t.steps.recall && `${t.steps.recall.passages} passages from ${t.steps.recall.sources.join(", ") || "nothing readable"} via ${t.steps.recall.model}` },
  { key: "hephaestus", god: "Hephaestus", text: (t: Turn) => t.steps.hephaestus ? `${t.steps.hephaestus.tool} ${t.steps.hephaestus.status} as ${t.steps.hephaestus.as_user ?? t.user}` : (t.done && t.steps.hermes?.intent !== "action" ? "not needed for a question" : undefined) },
] as const;

export function StepRail({ turn }: { turn: Turn }) {
  return (
    <ol className="mb-3 grid gap-1.5 font-mono text-[11.5px]">
      {STEPS.map(({ key, god, text }) => {
        const detail = text(turn);
        const lit = Boolean(detail) && !(key === "hephaestus" && detail?.startsWith("not needed"));
        return (
          <li key={key} className="grid grid-cols-[96px_1fr] items-baseline gap-2.5">
            <span className={`font-serif text-sm font-semibold uppercase tracking-[0.08em] transition-colors duration-500 ${lit ? "text-accent" : "text-fg-2"} ${detail?.startsWith("not needed") ? "opacity-45" : ""}`}>{god}</span>
            <span className="text-muted">{detail ?? (turn.done ? "" : "…")}</span>
          </li>
        );
      })}
    </ol>
  );
}
```

```tsx
// web/components/chat/ActionCard.tsx
"use client";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { Action, User } from "@/lib/types";
import { useState } from "react";

export function ActionCard({ action, user }: { action: Action; user: User }) {
  const s = useSession();
  const [state, setState] = useState<{ busy: boolean; result?: Record<string, unknown>; error?: string }>({ busy: false });
  const input = (action.input ?? {}) as Record<string, unknown>;
  const text = String(input.text ?? input.body ?? "");
  const run = async () => {
    setState({ busy: true });
    try { setState({ busy: false, result: await api.execute(user, action.tool, input) }); }
    catch (e) { setState({ busy: false, error: (e as Error).message }); }
  };
  const done = state.result ?? (action.status !== "dry-run" ? action : null);
  return (
    <div className="mt-3 border border-line-2 px-3 py-2 text-[12.5px]">
      <div className="mb-1.5 flex flex-wrap gap-2.5 font-mono text-[11px] text-muted">
        <span>tool {action.tool}</span><span>status {done ? String(done.status ?? "executed") : action.status}</span>
        {action.as_user && <span>as {action.as_user}</span>}
        {typeof input.channel === "string" && <span>to {input.channel}</span>}
        {typeof input.title === "string" && <span>title {input.title}</span>}
      </div>
      {text && <p className="text-fg">“{text}”</p>}
      {state.error && <p className="mt-2 font-mono text-[11px] text-muted">Could not execute: {state.error}</p>}
      {done && typeof done.url === "string" && <a className="mt-2 inline-block font-mono text-[11px] text-accent" href={done.url} target="_blank" rel="noreferrer">Open in {action.tool.startsWith("slack") ? "Slack" : "GitHub"}</a>}
      {s.mode === "live" && action.status === "dry-run" && !state.result && (
        <button onClick={run} disabled={state.busy} className="btn btn-sm btn-primary mt-2">{state.busy ? "Executing" : "Execute as user"}</button>
      )}
    </div>
  );
}
```

```tsx
// web/components/chat/ProposalCard.tsx
"use client";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { Proposal } from "@/lib/types";
import { useState } from "react";

const TOOL_LABEL: Record<string, string> = { slack_send_message: "Send a Slack message", github_issue_create: "Open a GitHub issue", request_access: "Ask for access" };

/* A follow-up Hephaestus proposed. The person approves, declines, or revises with a note. */
export function ProposalCard({ proposal, onChange }: { proposal: Proposal; onChange: (next: Proposal | null) => void }) {
  const s = useSession();
  const [note, setNote] = useState("");
  const [revising, setRevising] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = proposal.input ?? {};
  const body = String(input.text ?? input.body ?? input.message ?? "");
  const act = async (decision: "approve" | "decline" | "revise") => {
    setBusy(decision); setError(null);
    try {
      const d = await api.decide(proposal.id, decision, decision === "revise" ? note : undefined, decision === "approve");
      if (d.decision === "revise") { onChange(d.proposal); setRevising(false); setNote(""); }
      else onChange(d.action);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  };
  const settled = proposal.status !== "proposed";
  return (
    <div className={`mt-3 border px-3 py-2.5 text-[12.5px] ${settled ? "border-line" : "border-accent/50 bg-accent-dim"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-serif text-base font-semibold">{TOOL_LABEL[proposal.tool] ?? proposal.tool}</span>
        <span className="font-mono text-[11px] text-muted">{proposal.origin} · {proposal.status}{proposal.as_user ? ` · as ${proposal.as_user}` : ""}</span>
      </div>
      <p className="mt-1 text-fg-2">{proposal.rationale}</p>
      {body && <p className="mt-2 text-fg">“{body}”</p>}
      {typeof input.title === "string" && <p className="mt-1 font-mono text-[11px] text-muted">title {input.title}</p>}
      {typeof input.channel === "string" && <p className="font-mono text-[11px] text-muted">to {input.channel}</p>}
      {proposal.tool === "request_access" && typeof input.owner === "string" && <p className="font-mono text-[11px] text-muted">owner {input.owner} · dataset {String(input.dataset ?? "")}</p>}
      {error && <p className="mt-2 font-mono text-[11px] text-muted">Could not record the decision: {error}</p>}
      {s.mode === "live" && !settled && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button onClick={() => act("approve")} disabled={!!busy} className="btn btn-sm btn-primary">{busy === "approve" ? "Approving" : "Approve"}</button>
          <button onClick={() => act("decline")} disabled={!!busy} className="btn btn-sm">{busy === "decline" ? "Declining" : "Decline"}</button>
          <button onClick={() => setRevising(!revising)} disabled={!!busy} className="btn btn-sm">Revise</button>
          {revising && (
            <>
              <label htmlFor={`note-${proposal.id}`} className="sr-only">Revision note</label>
              <input id={`note-${proposal.id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should change?" className="min-w-[200px] flex-1 border border-line-2 bg-bg px-2 py-1.5 text-fg placeholder:text-muted focus:border-accent focus:outline-none" />
              <button onClick={() => act("revise")} disabled={!!busy || !note.trim()} className="btn btn-sm">{busy === "revise" ? "Redrafting" : "Send note"}</button>
            </>
          )}
        </div>
      )}
      {settled && proposal.result && typeof proposal.result.url === "string" && <a className="mt-2 inline-block font-mono text-[11px] text-accent" href={proposal.result.url} target="_blank" rel="noreferrer">Open the result</a>}
    </div>
  );
}
```

```tsx
// web/components/chat/UsageFooter.tsx
import type { Result } from "@/lib/types";
import { useState } from "react";

export function UsageFooter({ result }: { result: Result }) {
  const [open, setOpen] = useState(false);
  const tokens = result.usage.reduce((n, u) => n + (u.prompt_tokens ?? 0) + (u.completion_tokens ?? 0), 0);
  return (
    <div className="mt-3 border-t border-line pt-2 font-mono text-[11px] text-muted">
      <button onClick={() => setOpen(!open)} className="flex w-full justify-between hover:text-fg-2">
        <span>{result.usage.length} model calls · {tokens.toLocaleString()} tokens · est. ${result.cost_usd.toFixed(4)}</span><span>{result.latency_s.toFixed(1)} s</span>
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-[1fr_auto_auto] gap-x-3.5 gap-y-1">
          {result.usage.map((u, i) => (
            <div key={i} className="contents"><span>{u.step} · {u.model}</span><span className="num text-right">{u.prompt_tokens ?? 0} / {u.completion_tokens ?? 0}</span><span className="num text-right">{u.model}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}
```

```tsx
// web/components/chat/TurnView.tsx
"use client";
import type { Turn } from "@/lib/chat";
import { highlight } from "@/lib/highlight";
import { ActionCard } from "./ActionCard";
import { HiddenCard } from "./HiddenCard";
import { ProposalCard } from "./ProposalCard";
import { StepRail } from "./StepRail";
import { UsageFooter } from "./UsageFooter";
import type { Proposal } from "@/lib/types";
import { useEffect, useState } from "react";

export function TurnView({ turn, onGranted }: { turn: Turn; onGranted: () => void }) {
  const terms = turn.steps.themis?.hits ?? [];
  const parts = highlight(turn.answer, terms);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  useEffect(() => { setProposals(turn.steps.proposals ?? []); }, [turn.steps.proposals]);
  const replaceProposal = (id: string) => (next: Proposal | null) => setProposals((ps) => ps.flatMap((p) => (p.id === id ? (next ? [next] : []) : [p])));
  return (
    <article className="border border-line bg-bg-2 p-4">
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <span className="font-serif text-xl font-semibold capitalize tracking-[0.04em]">{turn.user}</span>
        <span className="font-mono text-[11px] text-muted">{turn.question}</span>
      </header>
      <StepRail turn={turn} />
      <div className="border border-line bg-bg px-3.5 py-3 text-[13.5px] leading-relaxed">
        {turn.error ? <span className="text-muted">Something went wrong: {turn.error}</span>
          : parts.map((p, i) => p.hit ? <mark key={i} className="bg-transparent text-accent-hi">{p.text}</mark> : <span key={i}>{p.text}</span>)}
        {!turn.done && !turn.error && <span className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-accent align-text-bottom" />}
      </div>
      {turn.result && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {turn.result.sources.map((s) => <span key={s} className="border border-accent/50 bg-accent-dim px-2 py-0.5 font-mono text-[11px] text-accent">{s}</span>)}
        </div>
      )}
      {turn.steps.cerberus && Object.keys(turn.steps.cerberus.hidden).length > 0 && <HiddenCard hidden={turn.steps.cerberus.hidden} user={turn.user} onGranted={onGranted} />}
      {turn.steps.hephaestus && <ActionCard action={turn.steps.hephaestus} user={turn.user} />}
      {proposals.length > 0 && (
        <div className="mt-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Hephaestus suggests</div>
          {proposals.map((p) => <ProposalCard key={p.id} proposal={p} onChange={replaceProposal(p.id)} />)}
        </div>
      )}
      {turn.steps.themis && (
        <div className={`mt-2.5 font-mono text-[11px] ${turn.steps.themis.fact_score >= 1 ? "text-accent" : "text-muted"}`}>
          Themis · fact check {turn.steps.themis.fact_score.toFixed(2)}
          {turn.steps.themis.missing.length > 0 && ` · missing ${turn.steps.themis.missing.join(", ")}`}
          {turn.steps.themis.leaks.length > 0 && ` · leaked ${turn.steps.themis.leaks.join(", ")}`}
        </div>
      )}
      {turn.result && <UsageFooter result={turn.result} />}
    </article>
  );
}
```

```tsx
// web/components/chat/Composer.tsx
"use client";
import { useState } from "react";

export const SCENARIOS = [
  { label: "PR #3 blocker", q: "What is blocking PR #3, who owns it, and which issue tracks the blocker?" },
  { label: "Pro plan price", q: "What will the Pro plan cost after the Atlas launch?" },
  { label: "Launch risk", q: "Is the Atlas launch date at risk? If so, what is the fallback date and the deadline that decides it?" },
  { label: "Open an issue for Marco", q: "Open a GitHub issue asking Marco to add exponential backoff to the Paddle webhook handler so PR #3 can merge." },
];

export function Composer({ busy, compare, onCompare, onSend }: { busy: boolean; compare: boolean; onCompare: (v: boolean) => void; onSend: (q: string) => void }) {
  const [q, setQ] = useState("");
  const send = () => { const v = q.trim(); if (v && !busy) { onSend(v); setQ(""); } };
  return (
    <div className="border-t border-line bg-bg-2 p-4">
      <div className="mb-2 flex flex-wrap gap-2">
        {SCENARIOS.map((s) => <button key={s.label} onClick={() => setQ(s.q)} className="border border-line-2 px-2.5 py-1 text-[12px] text-fg-2 hover:border-accent hover:text-accent">{s.label}</button>)}
      </div>
      <div className="flex gap-2">
        <label htmlFor="composer" className="sr-only">Ask the brain</label>
        <input id="composer" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ask the brain"
          className="min-w-0 flex-1 border border-line-2 bg-bg px-3 py-2 text-fg placeholder:text-muted focus:border-accent focus:outline-none" />
        <label className="flex items-center gap-2 font-mono text-[11px] text-fg-2"><input type="checkbox" id="compare" checked={compare} onChange={(e) => onCompare(e.target.checked)} />Compare both</label>
        <button onClick={send} disabled={busy} className="btn btn-sm btn-primary">{busy ? "Thinking" : "Ask"}</button>
      </div>
    </div>
  );
}
```

```tsx
// web/components/chat/Chat.tsx
"use client";
import { api } from "@/lib/api";
import { applyEvent, newTurn, type Turn } from "@/lib/chat";
import { findRecorded, replay } from "@/lib/recorded";
import { useSession } from "@/lib/session";
import type { ChatEvent, User } from "@/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { Composer } from "./Composer";
import { TurnView } from "./TurnView";

export function Chat() {
  const s = useSession();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [compare, setCompare] = useState(false);
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [turns]);

  const update = (id: string, e: ChatEvent) => setTurns((ts) => ts.map((t) => (t.id === id ? applyEvent(t, e) : t)));

  const runOne = useCallback(async (user: User, question: string) => {
    const t = newTurn(user, question);
    setTurns((ts) => [...ts, t]);
    const onEvent = (e: ChatEvent) => { update(t.id, e); const r = applyEvent(t, e).region; if (r) s.setRegion(r); };
    try {
      if (s.mode === "live") await api.chat(user, question, onEvent);
      else {
        const rec = findRecorded(user, question, s.granted(user));
        if (!rec) onEvent({ name: "error", data: { detail: "No recorded answer for this question. Connect the API for live answers." } });
        else await replay(rec, onEvent);
      }
    } catch (e) { onEvent({ name: "error", data: { detail: (e as Error).message } }); }
  }, [s]);

  const send = async (q: string) => {
    setBusy(true);
    try { if (compare) await Promise.all([runOne("alice", q), runOne("bob", q)]); else await runOne(s.user, q); }
    finally { setBusy(false); s.setRegion(null); }
  };

  const pairs: Turn[][] = [];
  for (const t of turns) { const last = pairs.at(-1); if (compare && last && last.length === 1 && last[0].question === t.question && last[0].user !== t.user) last.push(t); else pairs.push([t]); }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {turns.length === 0 && (
          <div className="mx-auto max-w-md pt-24 text-center text-fg-2">
            <p className="font-serif text-3xl text-fg">Ask the brain</p>
            <p className="mt-3 text-sm">Pick a question below or type your own. Switch who is asking in the rail; the answer changes with the person.</p>
          </div>
        )}
        {pairs.map((pair) => (
          <div key={pair[0].id} className={pair.length === 2 ? "grid gap-4 lg:grid-cols-2" : ""}>
            {pair.map((t) => <TurnView key={t.id} turn={t} onGranted={() => void runOne(t.user, t.question)} />)}
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <Composer busy={busy} compare={compare} onCompare={setCompare} onSend={send} />
    </div>
  );
}
```

```tsx
// web/app/app/page.tsx
import { Chat } from "@/components/chat/Chat";
export default function ChatPage() { return <Chat />; }
```

- [ ] **Step 4: Run tests and try the page in recorded mode**

Run: `pnpm test` then `pnpm dev`, open `/app`, click "Pro plan price", Ask.
Expected: 15 passed; the turn streams word by word, the step rail lights Hermes, Cerberus, Athena in order, Bob shows the hidden card without a Grant button (recorded mode), the brain stub label changes through thalamus, amygdala, hippocampus, prefrontal.

- [ ] **Step 5: Commit**

```bash
git add web/app/app/page.tsx web/components/chat web/lib/highlight.ts web/lib/highlight.test.ts web/vitest.config.ts
git commit -m "web: streaming chat with step rail, hidden card, action card, compare"
```

---

### Task 7: Evals page

**Files:**
- Create: `web/app/app/evals/page.tsx`, `web/components/app/EvalsView.tsx`, `web/lib/evals.ts`
- Test: `web/lib/evals.test.ts`

**Interfaces:**
- Produces: `pairRows(before: Results | null, after: Results | null) -> Array<{id, as_user, question, before: number | null, after: number | null, missing: string[], leaks: string[]}>`; `<EvalsView />` fetching `api.evals()` in live mode and importing `@/data/evals.json` (a copy of the three results files, created in this task) in recorded mode.

- [ ] **Step 1: Write the failing test**

```ts
// web/lib/evals.test.ts
import { describe, expect, it } from "vitest";
import { pairRows } from "./evals";
import type { Results } from "./types";

const row = (id: string, final: number): Results["rows"][number] => ({ id, as_user: "bob", question: "q", answer: "a", sources: [], hidden: [], score: { final, missing: [], leaks: [], ungrounded: [] }, latency_s: 1 });

describe("pairRows", () => {
  it("joins by id and tolerates a missing side", () => {
    const before: Results = { label: "b", n: 2, mean: 0.5, models: {}, rows: [row("x", 0.4), row("y", 0.6)] };
    const after: Results = { label: "a", n: 1, mean: 1, models: {}, rows: [row("x", 1)] };
    const rows = pairRows(before, after);
    expect(rows.map((r) => [r.id, r.before, r.after])).toEqual([["x", 0.4, 1], ["y", 0.6, null]]);
    expect(pairRows(null, after)[0]).toMatchObject({ id: "x", before: null, after: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL, cannot resolve `./evals`

- [ ] **Step 3: Write the implementation**

```ts
// web/lib/evals.ts
import type { Results } from "./types";

export type PairedRow = { id: string; as_user: string; question: string; before: number | null; after: number | null; missing: string[]; leaks: string[] };

export function pairRows(before: Results | null, after: Results | null): PairedRow[] {
  const ids = [...new Set([...(before?.rows ?? []).map((r) => r.id), ...(after?.rows ?? []).map((r) => r.id)])];
  const b = new Map((before?.rows ?? []).map((r) => [r.id, r])); const a = new Map((after?.rows ?? []).map((r) => [r.id, r]));
  return ids.map((id) => {
    const br = b.get(id), ar = a.get(id); const src = ar ?? br!;
    return { id, as_user: src.as_user, question: src.question, before: br?.score.final ?? null, after: ar?.score.final ?? null,
      missing: ar?.score.missing ?? br?.score.missing ?? [], leaks: ar?.score.leaks ?? br?.score.leaks ?? [] };
  });
}
```

```bash
# copy the committed results for recorded mode
node -e 'const fs=require("fs");const r=l=>JSON.parse(fs.readFileSync(`../evals/results-${l}.json`));fs.writeFileSync("data/evals.json",JSON.stringify({before:r("before-coverage"),after:r("after"),isolation:r("before"),change:"grant alice to bob (read on alice-brain)"}))'
```

```tsx
// web/components/app/EvalsView.tsx
"use client";
import recorded from "@/data/evals.json";
import { api } from "@/lib/api";
import { pairRows } from "@/lib/evals";
import { useSession } from "@/lib/session";
import type { Evals } from "@/lib/types";
import { useEffect, useState } from "react";

export function EvalsView() {
  const s = useSession();
  const [ev, setEv] = useState<Evals | null>(null);
  useEffect(() => { if (s.mode === "live") api.evals().then(setEv).catch(() => setEv(recorded as Evals)); else if (s.mode === "recorded") setEv(recorded as Evals); }, [s.mode]);
  if (!ev) return <div className="p-6 font-mono text-[12px] text-muted">Loading evals</div>;
  const rows = pairRows(ev.before, ev.after);
  const Num = ({ v, label, lit }: { v: number | null | undefined; label: string; lit?: boolean }) => (
    <div className="border border-line bg-bg-2 p-6"><div className={`font-serif text-7xl leading-none ${lit ? "text-accent" : ""}`}>{v == null ? "n/a" : v.toFixed(2)}</div><div className="mt-3 font-mono text-[12px] text-muted">{label}</div></div>
  );
  return (
    <div className="space-y-6 p-6">
      <div className="grid gap-3 md:grid-cols-3">
        <Num v={ev.isolation?.mean} label="isolation run, zero leaks expected" />
        <Num v={ev.before?.mean} label="coverage before the share" />
        <Num v={ev.after?.mean} label={`after · ${ev.change}`} lit />
      </div>
      <table className="w-full border-collapse font-mono text-[12px]">
        <thead><tr className="text-left text-muted"><th className="py-2 pr-3 font-normal">scenario</th><th className="font-normal">as</th><th className="text-right font-normal">before</th><th className="text-right font-normal">after</th><th className="pl-3 font-normal">notes</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-line">
              <td className="py-2 pr-3">{r.id}</td><td>{r.as_user}</td>
              <td className="num text-right">{r.before?.toFixed(2) ?? ""}</td>
              <td className={`num text-right ${r.after != null && r.before != null && r.after > r.before ? "text-accent" : ""}`}>{r.after?.toFixed(2) ?? ""}</td>
              <td className="pl-3 text-muted">{r.leaks.length ? `leaked ${r.leaks.join(", ")}` : r.missing.length ? `missing ${r.missing.join(", ")}` : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

```tsx
// web/app/app/evals/page.tsx
import { EvalsView } from "@/components/app/EvalsView";
export default function EvalsPage() { return <EvalsView />; }
```

- [ ] **Step 4: Write the Actions page (pending proposals across turns)**

```tsx
// web/components/app/ActionsView.tsx
"use client";
import { ProposalCard } from "@/components/chat/ProposalCard";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { Proposal } from "@/lib/types";
import { useEffect, useState } from "react";

export function ActionsView() {
  const s = useSession();
  const [items, setItems] = useState<Proposal[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (s.mode !== "live") return;
    setItems(null); api.actions(s.user).then(setItems).catch((e) => setErr((e as Error).message));
  }, [s.user, s.mode]);
  if (s.mode !== "live") return <div className="p-6 text-fg-2">Proposals need the live API. In recorded mode nothing is waiting for you.</div>;
  return (
    <div className="max-w-3xl p-6">
      <h2 className="text-3xl">Waiting for {s.user}</h2>
      <p className="mt-2 text-sm text-fg-2">Hephaestus proposes follow-ups after answers. Approve to act as you, decline, or revise with a note. The brain remembers every decision.</p>
      {err && <p className="mt-6 font-mono text-[12px] text-muted">Could not load proposals: {err}</p>}
      {items && items.length === 0 && <p className="mt-6 text-fg-2">Nothing pending. Ask the brain something and see what it suggests.</p>}
      {items?.map((p) => <ProposalCard key={p.id} proposal={p} onChange={(next) => setItems((xs) => (xs ?? []).flatMap((x) => (x.id === p.id ? (next && next.status === "proposed" ? [next] : []) : [x])))} />)}
    </div>
  );
}
```

```tsx
// web/app/app/actions/page.tsx
import { ActionsView } from "@/components/app/ActionsView";
export default function ActionsPage() { return <ActionsView />; }
```

- [ ] **Step 5: Run tests and view the pages**

Run: `pnpm test`; open `/app/evals` and `/app/actions`.
Expected: 16 passed; three numbers (0.99, 0.89, 1.00) and fifteen rows; the actions page explains recorded mode.

- [ ] **Step 6: Commit**

```bash
git add web/app/app/evals web/app/app/actions web/components/app/EvalsView.tsx web/components/app/ActionsView.tsx web/lib/evals.ts web/lib/evals.test.ts web/data/evals.json
git commit -m "web: evals page and pending actions page"
```

---

### Task 8: Brain geometry, regions, choreography (pure)

**Files:**
- Create: `web/lib/brain/geometry.ts`, `web/lib/brain/choreo.ts`
- Test: `web/lib/brain/geometry.test.ts`, `web/lib/brain/choreo.test.ts`

**Interfaces:**
- Produces: `type Vec3 = [number, number, number]`; `type RegionName = Exclude<Region, null>`; `samplePoints(n: number, seed: number) -> Vec3[]` (deterministic, all inside the volume); `inside(p: Vec3) -> boolean`; `regionOf(p: Vec3) -> RegionName | "cortex"`; `neighbours(points: Vec3[], k = 2, maxDist = 0.09) -> [number, number][]`; `CAMERA: Record<RegionName, {az: number; el: number; dist: number}>`; `spring(current, target, velocity, dt, stiffness = 120, damping = 22) -> [value, velocity]`; `orbitToPosition(az, el, dist) -> Vec3`.

- [ ] **Step 1: Write the failing tests**

```ts
// web/lib/brain/geometry.test.ts
import { describe, expect, it } from "vitest";
import { inside, neighbours, regionOf, samplePoints } from "./geometry";

describe("geometry", () => {
  it("samples deterministically inside the volume", () => {
    const a = samplePoints(300, 7), b = samplePoints(300, 7);
    expect(a).toEqual(b);
    expect(a).toHaveLength(300);
    expect(a.every(inside)).toBe(true);
    expect(a.every(([, , z]) => Math.abs(z) >= 0.03 || z === 0 && false)).toBe(true);
  });
  it("assigns the documented regions", () => {
    expect(regionOf([0, 0.02, 0])).toBe("thalamus");
    expect(regionOf([0.12, -0.16, 0.22])).toBe("amygdala");
    expect(regionOf([0.5, 0.1, 0.2])).toBe("prefrontal");
    expect(regionOf([0.3, -0.2, 0.2])).toBe("orbitofrontal");
    expect(regionOf([0.0, 0.42, 0.15])).toBe("motor");
    expect(regionOf([-0.4, 0.1, 0.2])).toBe("cortex");
  });
  it("links each point to at most k neighbours within range", () => {
    const pts = samplePoints(200, 3);
    const edges = neighbours(pts, 2, 0.09);
    expect(edges.length).toBeLessThanOrEqual(400);
    for (const [i, j] of edges) {
      const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1], pts[i][2] - pts[j][2]);
      expect(d).toBeLessThanOrEqual(0.09);
    }
  });
});
```

```ts
// web/lib/brain/choreo.ts tests
// web/lib/brain/choreo.test.ts
import { describe, expect, it } from "vitest";
import { CAMERA, orbitToPosition, spring } from "./choreo";

describe("choreo", () => {
  it("has a target for every region", () => {
    expect(Object.keys(CAMERA).sort()).toEqual(["amygdala", "hippocampus", "motor", "orbitofrontal", "prefrontal", "sleep", "thalamus"]);
    expect(CAMERA.prefrontal).toEqual({ az: 15, el: 8, dist: 2.1 });
  });
  it("spring converges without overshooting much", () => {
    let v = 0, x = 0;
    for (let i = 0; i < 240; i++) [x, v] = spring(x, 1, v, 1 / 60);
    expect(Math.abs(x - 1)).toBeLessThan(0.01);
  });
  it("orbit maps az/el/dist to a position on the sphere", () => {
    const [x, y, z] = orbitToPosition(0, 0, 2);
    expect([x, y, z].map((n) => +n.toFixed(3))).toEqual([2, 0, 0]);
    const [, y2] = orbitToPosition(0, 90, 2);
    expect(+y2.toFixed(3)).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test`
Expected: FAIL, cannot resolve `./geometry` and `./choreo`

- [ ] **Step 3: Write the implementation**

```ts
// web/lib/brain/geometry.ts
export type Vec3 = [number, number, number];
export type RegionName = "thalamus" | "amygdala" | "hippocampus" | "prefrontal" | "motor" | "orbitofrontal" | "sleep";

function rng(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

function gyri(x: number, y: number, z: number): number {
  return 0.04 * (Math.sin(9 * x + 2 * y) * Math.cos(7 * y - 3 * z) + 0.6 * Math.sin(11 * z + 4 * x)) / 1.6;
}

export function inside([x, y, z]: Vec3): boolean {
  if (Math.abs(z) < 0.03 && y > -0.3) return false;                         // longitudinal fissure
  for (const side of [-0.1, 0.1]) {
    const dz = z - side;
    const r = ((x) / 0.62) ** 2 + ((y) / 0.48) ** 2 + (dz / 0.4) ** 2;
    if (r <= 1 + gyri(x, y, z) * 2) return true;                            // hemisphere with gyri displacement
  }
  if (((x + 0.42) / 0.22) ** 2 + ((y + 0.34) / 0.14) ** 2 + (z / 0.26) ** 2 <= 1) return true; // cerebellum
  const t = (y + 0.4) / -0.38;                                               // brain stem, y from -0.40 down to -0.78
  if (t >= 0 && t <= 1) { const cx = -0.28 - 0.02 * t; if (Math.hypot(x - cx, z) <= 0.07) return true; }
  return false;
}

export function regionOf([x, y, z]: Vec3): RegionName | "cortex" {
  if (Math.hypot(x, y - 0.02, z) <= 0.1) return "thalamus";
  for (const s of [-0.22, 0.22]) if (Math.hypot(x - 0.12, y + 0.16, z - s) <= 0.06) return "amygdala";
  for (const s of [-0.24, 0.24]) {                                           // hippocampus: a tube from (.08,-.18,s) to (-.18,-.14,s+.02)
    const ax = 0.08, ay = -0.18, bx = -0.18, by = -0.14, bz = s + 0.02;
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
    const px = ax + t * (bx - ax), py = ay + t * (by - ay), pz = s + t * (bz - s);
    if (Math.hypot(x - px, y - py, z - pz) <= 0.05) return "hippocampus";
  }
  if (x > 0.36 && y > -0.1) return "prefrontal";
  if (x > 0.26 && y > -0.34 && y <= -0.1) return "orbitofrontal";
  if (x > -0.08 && x < 0.12 && y > 0.36) return "motor";
  return "cortex";
}

export function samplePoints(n: number, seed: number): Vec3[] {
  const r = rng(seed); const out: Vec3[] = [];
  while (out.length < n) {
    const p: Vec3 = [r() * 1.5 - 0.8, r() * 1.4 - 0.85, r() * 1.1 - 0.55];
    if (inside(p)) out.push(p);
  }
  return out;
}

export function neighbours(points: Vec3[], k = 2, maxDist = 0.09): [number, number][] {
  const cell = maxDist; const grid = new Map<string, number[]>();
  const key = (p: Vec3) => `${Math.floor(p[0] / cell)},${Math.floor(p[1] / cell)},${Math.floor(p[2] / cell)}`;
  points.forEach((p, i) => { const k2 = key(p); (grid.get(k2) ?? grid.set(k2, []).get(k2)!).push(i); });
  const edges: [number, number][] = []; const seen = new Set<string>();
  points.forEach((p, i) => {
    const cand: [number, number][] = [];
    const [gx, gy, gz] = [Math.floor(p[0] / cell), Math.floor(p[1] / cell), Math.floor(p[2] / cell)];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++)
      for (const j of grid.get(`${gx + dx},${gy + dy},${gz + dz}`) ?? []) {
        if (j === i) continue;
        const d = Math.hypot(p[0] - points[j][0], p[1] - points[j][1], p[2] - points[j][2]);
        if (d <= maxDist) cand.push([d, j]);
      }
    cand.sort((a, b) => a[0] - b[0]);
    for (const [, j] of cand.slice(0, k)) { const id = i < j ? `${i}-${j}` : `${j}-${i}`; if (!seen.has(id)) { seen.add(id); edges.push([i, j]); } }
  });
  return edges;
}
```

```ts
// web/lib/brain/choreo.ts
import type { RegionName, Vec3 } from "./geometry";

export const CAMERA: Record<RegionName, { az: number; el: number; dist: number }> = {
  thalamus: { az: 60, el: 18, dist: 1.9 }, amygdala: { az: 95, el: -22, dist: 1.8 }, hippocampus: { az: 120, el: -30, dist: 1.8 },
  prefrontal: { az: 15, el: 8, dist: 2.1 }, motor: { az: 40, el: 70, dist: 2.0 }, orbitofrontal: { az: 20, el: -35, dist: 1.9 },
  sleep: { az: 0, el: 10, dist: 2.4 },
};
export const SLEEP_TURN_SECONDS = 40;

export function spring(current: number, target: number, velocity: number, dt: number, stiffness = 120, damping = 22): [number, number] {
  const accel = stiffness * (target - current) - damping * velocity;
  const v = velocity + accel * dt;
  return [current + v * dt, v];
}

export function orbitToPosition(azDeg: number, elDeg: number, dist: number): Vec3 {
  const az = (azDeg * Math.PI) / 180, el = (elDeg * Math.PI) / 180;
  return [dist * Math.cos(el) * Math.cos(az), dist * Math.sin(el), dist * Math.cos(el) * Math.sin(az)];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: 22 passed. If the fissure assertion fails because of the gyri displacement, loosen the `inside` fissure check to `Math.abs(z) < 0.03` only above the cerebellum (`y > -0.3`), which is what the code does; the test's second `every` is the one to keep.

- [ ] **Step 5: Commit**

```bash
git add web/lib/brain
git commit -m "web: brain geometry, regions and camera choreography"
```

---

### Task 9: Brain renderer with four modes

**Files:**
- Create: `web/components/Brain.tsx`, `web/components/Brain2D.tsx`, `web/components/app/BrainPanel.tsx` (replace stub), `web/lib/brain/webgl.ts`
- Test: `web/lib/brain/webgl.test.ts`

**Interfaces:**
- Produces: `hasWebGL(): boolean` (creates a canvas and tries `webgl2` then `webgl`; false on throw); `<Brain mode="autoplay" | "scroll" | "live" | "graph" activeRegion?: RegionName | null graph?: Graph className?: string onRegion?: (r: RegionName) => void />`.
- Consumes: `samplePoints`, `regionOf`, `neighbours`, `CAMERA`, `spring`, `orbitToPosition`, `SLEEP_TURN_SECONDS`, `useSession` (BrainPanel only).

- [ ] **Step 1: Write the failing test**

```ts
// web/lib/brain/webgl.test.ts
import { describe, expect, it, vi } from "vitest";
import { hasWebGL } from "./webgl";

describe("hasWebGL", () => {
  it("is false when getContext throws or returns null (jsdom)", () => {
    expect(hasWebGL()).toBe(false);
  });
  it("is true when a webgl context is available", () => {
    const spy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as never);
    expect(hasWebGL()).toBe(true);
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL, cannot resolve `./webgl`

- [ ] **Step 3: Write the implementation**

```ts
// web/lib/brain/webgl.ts
export function hasWebGL(): boolean {
  if (typeof document === "undefined") return false;
  try { const c = document.createElement("canvas"); return Boolean(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}
```

```tsx
// web/components/Brain.tsx
"use client";
import { CAMERA, SLEEP_TURN_SECONDS, orbitToPosition, spring } from "@/lib/brain/choreo";
import { neighbours, regionOf, samplePoints, type RegionName, type Vec3 } from "@/lib/brain/geometry";
import { hasWebGL } from "@/lib/brain/webgl";
import type { Graph } from "@/lib/types";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Brain2D } from "./Brain2D";

export type BrainMode = "autoplay" | "scroll" | "live" | "graph";
const REGIONS: RegionName[] = ["thalamus", "amygdala", "hippocampus", "prefrontal", "motor", "orbitofrontal", "sleep"];
const ACCENT = new THREE.Color("#c8602c"), ACCENT_HI = new THREE.Color("#e8843f"), BONE = new THREE.Color("#efe6d8");

type Props = { mode: BrainMode; activeRegion?: RegionName | null; graph?: Graph; className?: string; onRegion?: (r: RegionName) => void };

export function Brain(props: Props) {
  const [gl, setGl] = useState<boolean | null>(null);
  useEffect(() => setGl(hasWebGL()), []);
  if (gl === null) return <div className={props.className} aria-hidden />;
  if (!gl) return <Brain2D {...props} />;
  return <Brain3D {...props} />;
}

function Brain3D({ mode, activeRegion, graph, className, onRegion }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef({ region: (activeRegion ?? "thalamus") as RegionName, azOffset: 0, pointer: [0, 0] as [number, number] });
  useEffect(() => { if (activeRegion) state.current.region = activeRegion; }, [activeRegion]);

  useEffect(() => {
    const el = host.current; if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.innerWidth < 768;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 20);

    // geometry: parametric cloud, or the real graph laid out by Task 11's worker
    const pts: Vec3[] = graph?.nodes.length ? layoutFromGraph(graph) : samplePoints(small ? 1200 : 2400, 11);
    const regions = pts.map(regionOf);
    const edges = graph?.nodes.length ? graphEdges(graph) : neighbours(pts, 2, 0.09);
    const base = new Float32Array(pts.flat());
    const positions = new Float32Array(base);
    const colors = new Float32Array(pts.length * 3);
    const sizes = new Float32Array(pts.length);
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    pGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    pGeo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    const pMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { dpr: { value: renderer.getPixelRatio() } },
      vertexShader: `attribute float size; varying vec3 vC; varying float vS; void main(){ vC=color; vS=size; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*dpr*(2.2/-mv.z); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 vC; varying float vS; void main(){ float d=length(gl_PointCoord-0.5); if(d>0.5) discard; float a=smoothstep(0.5,0.1,d); gl_FragColor=vec4(vC, a*(vS>2.5?0.95:0.35)); }`,
      vertexColors: true,
    });
    const points = new THREE.Points(pGeo, pMat); scene.add(points);
    const ePos = new Float32Array(edges.length * 6); const eCol = new Float32Array(edges.length * 6);
    const eGeo = new THREE.BufferGeometry();
    eGeo.setAttribute("position", new THREE.BufferAttribute(ePos, 3)); eGeo.setAttribute("color", new THREE.BufferAttribute(eCol, 3));
    const lines = new THREE.LineSegments(eGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(lines);

    const glow: Record<RegionName, number> = Object.fromEntries(REGIONS.map((r) => [r, 0])) as Record<RegionName, number>;
    let az = CAMERA.thalamus.az, el2 = CAMERA.thalamus.el, dist = CAMERA.thalamus.dist, vAz = 0, vEl = 0, vD = 0, t = 0, raf = 0, visible = true;
    const phase = pts.map((_, i) => (i * 0.618) % (Math.PI * 2));

    const resize = () => { const w = el.clientWidth || 1, h = el.clientHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    const ro = new ResizeObserver(resize); ro.observe(el); resize();
    const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (visible && !raf) raf = requestAnimationFrame(tick); }, { threshold: 0.05 }); io.observe(el);
    const onMove = (e: PointerEvent) => { const b = el.getBoundingClientRect(); state.current.pointer = [((e.clientX - b.left) / b.width - 0.5) * 2, ((e.clientY - b.top) / b.height - 0.5) * 2]; };
    if (mode === "autoplay" && !reduce) el.addEventListener("pointermove", onMove);

    let auto = 0; let autoTimer = 0;
    if (mode === "autoplay" && !reduce) autoTimer = window.setInterval(() => { auto = (auto + 1) % REGIONS.length; state.current.region = REGIONS[auto]; onRegion?.(REGIONS[auto]); }, 2600);

    const frame = (dt: number) => {
      t += dt;
      const region = state.current.region; const target = CAMERA[region];
      const sleepAz = region === "sleep" ? ((t / SLEEP_TURN_SECONDS) * 360) % 360 : 0;
      const tAz = target.az + sleepAz + state.current.azOffset + (mode === "autoplay" ? state.current.pointer[0] * 6 : 0);
      const tEl = target.el + (mode === "autoplay" ? -state.current.pointer[1] * 6 : 0);
      if (reduce) { az = tAz; el2 = tEl; dist = target.dist; } else { [az, vAz] = spring(az, tAz, vAz, dt); [el2, vEl] = spring(el2, tEl, vEl, dt); [dist, vD] = spring(dist, target.dist, vD, dt); }
      const [cx, cy, cz] = orbitToPosition(az, el2, dist); camera.position.set(cx, cy, cz); camera.lookAt(0, 0, 0);
      for (const r of REGIONS) { const g = r === region ? 1 : 0; glow[r] = reduce ? g : glow[r] + (g - glow[r]) * Math.min(1, dt * 6); }
      const all = region === "sleep";
      for (let i = 0; i < pts.length; i++) {
        const r = regions[i]; const g = all ? glow.sleep * (0.6 + 0.4 * Math.sin(t * 1.3 + phase[i])) : (r !== "cortex" && r === region ? glow[r as RegionName] : 0);
        const wob = reduce ? 0 : Math.sin(t * 0.8 + phase[i]) * 0.004;
        positions[i * 3] = base[i * 3] + wob; positions[i * 3 + 1] = base[i * 3 + 1] + wob * 0.6; positions[i * 3 + 2] = base[i * 3 + 2];
        const c = g > 0.02 ? ACCENT_HI.clone().lerp(ACCENT, 1 - g) : BONE;
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b; sizes[i] = g > 0.02 ? 1.8 + 1.4 * g + 1.0 : 1.8;
      }
      edges.forEach(([a, b], k) => {
        const lit = !all && (regions[a] === region || regions[b] === region) ? glow[region] : all ? glow.sleep * 0.35 : 0;
        const c = lit > 0.02 ? ACCENT : BONE; const alpha = lit > 0.02 ? 0.4 * lit + 0.07 : 0.07;
        for (const [n, idx] of [[0, a], [1, b]] as const) {
          ePos.set([positions[idx * 3], positions[idx * 3 + 1], positions[idx * 3 + 2]], k * 6 + n * 3);
          eCol.set([c.r * alpha, c.g * alpha, c.b * alpha], k * 6 + n * 3);
        }
      });
      pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true; pGeo.attributes.size.needsUpdate = true;
      eGeo.attributes.position.needsUpdate = true; eGeo.attributes.color.needsUpdate = true;
      renderer.render(scene, camera);
    };
    let last = performance.now();
    const tick = (now: number) => { const dt = Math.min(0.05, (now - last) / 1000); last = now; frame(dt); raf = visible && !document.hidden && !reduce ? requestAnimationFrame(tick) : 0; };
    frame(0.016); if (!reduce) raf = requestAnimationFrame(tick);
    const onVis = () => { if (!document.hidden && visible && !raf && !reduce) { last = performance.now(); raf = requestAnimationFrame(tick); } };
    document.addEventListener("visibilitychange", onVis);
    const still = reduce ? window.setInterval(() => frame(0.016), 250) : 0;  // reduced motion: re-render on region change only

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); document.removeEventListener("visibilitychange", onVis); el.removeEventListener("pointermove", onMove);
      window.clearInterval(autoTimer); window.clearInterval(still);
      pGeo.dispose(); eGeo.dispose(); pMat.dispose(); (lines.material as THREE.Material).dispose(); renderer.dispose(); el.removeChild(renderer.domElement);
    };
  }, [mode, graph, onRegion]);

  return <div ref={host} className={className} aria-hidden style={{ position: "relative" }} />;
}

/* Real graph nodes carry positions from the layout worker (Task 11) in node.x/y/z scaled to the volume. */
function layoutFromGraph(graph: Graph): Vec3[] {
  return graph.nodes.map((n) => { const p = n as unknown as { x?: number; y?: number; z?: number }; return [p.x ?? 0, p.y ?? 0, p.z ?? 0]; });
}
function graphEdges(graph: Graph): [number, number][] {
  const idx = new Map(graph.nodes.map((n, i) => [n.id, i]));
  return graph.edges.flatMap((e) => { const a = idx.get(e.source), b = idx.get(e.target); return a != null && b != null ? [[a, b] as [number, number]] : []; });
}
```

```tsx
// web/components/Brain2D.tsx
"use client";
import { neighbours, regionOf, samplePoints, type RegionName } from "@/lib/brain/geometry";
import { useEffect, useRef } from "react";
import type { BrainMode } from "./Brain";

/* Fallback when WebGL is unavailable: an orthographic lateral projection of the same cloud. */
export function Brain2D({ activeRegion, className }: { mode: BrainMode; activeRegion?: RegionName | null; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return; const ctx = c.getContext("2d"); if (!ctx) return;
    const pts = samplePoints(900, 5); const regions = pts.map(regionOf); const edges = neighbours(pts, 2, 0.09);
    const draw = () => {
      const w = c.clientWidth, h = c.clientHeight; c.width = w * 2; c.height = h * 2; ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.clearRect(0, 0, w, h);
      const s = Math.min(w, h) * 0.62; const P = ([x, y]: number[]) => [w / 2 + x * s, h / 2 - y * s];
      for (const [a, b] of edges) { const lit = regions[a] === activeRegion || regions[b] === activeRegion; ctx.strokeStyle = lit ? "rgba(200,96,44,.45)" : "rgba(239,230,216,.07)"; ctx.beginPath(); ctx.moveTo(...(P(pts[a]) as [number, number])); ctx.lineTo(...(P(pts[b]) as [number, number])); ctx.stroke(); }
      pts.forEach((p, i) => { const lit = regions[i] === activeRegion || activeRegion === "sleep"; const [x, y] = P(p); ctx.fillStyle = lit ? "rgba(232,132,63,.95)" : "rgba(239,230,216,.28)"; ctx.beginPath(); ctx.arc(x, y, lit ? 2.4 : 1.3, 0, 6.28); ctx.fill(); });
    };
    draw(); const ro = new ResizeObserver(draw); ro.observe(c); return () => ro.disconnect();
  }, [activeRegion]);
  return <canvas ref={ref} className={className} aria-hidden style={{ width: "100%", height: "100%" }} />;
}
```

```tsx
// web/components/app/BrainPanel.tsx
"use client";
import { Brain } from "@/components/Brain";
import { useSession } from "@/lib/session";

const GOD: Record<string, string> = { thalamus: "Hermes", amygdala: "Cerberus", hippocampus: "Mnemosyne", prefrontal: "Athena", motor: "Hephaestus", orbitofrontal: "Themis", sleep: "Morpheus" };

export function BrainPanel() {
  const { region } = useSession();
  return (
    <div className="relative h-full">
      <Brain mode="live" activeRegion={region ?? "sleep"} className="h-full w-full" />
      <div className="pointer-events-none absolute left-5 top-5 grid gap-1">
        <span className="insc text-[12px]">{region ? GOD[region] : "Resting"}</span>
        <span className="font-serif text-2xl leading-none text-fg">{region ?? "sleep"}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests and look at the app**

Run: `pnpm test`; open `/app`, ask a recorded question.
Expected: 24 passed; the brain in the right column orbits from the resting slow turn to the thalamus as Hermes fires, then amygdala, hippocampus, prefrontal, with the region glowing orange and the label changing. No console errors. Frame rate near 60 on the laptop (check the Performance panel once).

- [ ] **Step 5: Commit**

```bash
git add web/components/Brain.tsx web/components/Brain2D.tsx web/components/app/BrainPanel.tsx web/lib/brain/webgl.ts web/lib/brain/webgl.test.ts
git commit -m "web: 3D brain renderer with region glow, camera choreography and 2D fallback"
```

---

### Task 10: Landing page

**Files:**
- Create: `web/app/page.tsx` (replace), `web/components/landing/Nav.tsx`, `web/components/landing/Hero.tsx`, `web/components/landing/Problem.tsx`, `web/components/landing/Pantheon.tsx`, `web/components/landing/AccessStory.tsx`, `web/components/landing/Layers.tsx`, `web/components/landing/Evaluation.tsx`, `web/components/landing/Quickstart.tsx`, `web/components/landing/Footer.tsx`, `web/components/landing/Reveal.tsx`, `web/data/agents.ts`
- Test: `web/data/agents.test.ts`

**Interfaces:**
- Produces: `AGENTS: Array<{region: RegionName, regionLabel: string, god: string, inYou: string, inPantheon: string, layer: string}>` in the documented order; `<Reveal>` client wrapper using Motion `whileInView`; `<Pantheon />` client section with the sticky brain in `scroll` mode and the seven blocks.

- [ ] **Step 1: Write the failing test**

```ts
// web/data/agents.test.ts
import { describe, expect, it } from "vitest";
import { AGENTS } from "./agents";

describe("agents copy", () => {
  it("has seven agents in brain order with no dashes and the generic connector line", () => {
    expect(AGENTS.map((a) => a.god)).toEqual(["Hermes", "Cerberus", "Mnemosyne", "Athena", "Hephaestus", "Themis", "Morpheus"]);
    for (const a of AGENTS) for (const s of [a.inYou, a.inPantheon, a.layer]) expect(s).not.toMatch(/[–—]/);
    expect(AGENTS[2].inPantheon).toContain("400+ Scalekit connectors");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL, cannot resolve `./agents`

- [ ] **Step 3: Write the copy, the sections and the page**

```ts
// web/data/agents.ts
import type { RegionName } from "@/lib/brain/geometry";

export const AGENTS: { region: RegionName; regionLabel: string; god: string; inYou: string; inPantheon: string; layer: string }[] = [
  { region: "thalamus", regionLabel: "Thalamus", god: "Hermes",
    inYou: "The relay at the centre of the brain. Nearly every signal from the senses passes through it on the way to the cortex, and it decides what gets attention.",
    inPantheon: "Every request passes through Hermes. He classifies it, picks which agents run and which model each step uses, and traces the whole run.",
    layer: "Respan gateway and traces" },
  { region: "amygdala", regionLabel: "Amygdala", god: "Cerberus",
    inYou: "The almond-shaped gatekeeper deep in the temporal lobe. It weighs threat and salience before you have time to think.",
    inPantheon: "The authorization gate. The Scalekit identity is the Cognee user; every recall is scoped to datasets that user may read. Cerberus also reports what is hidden, so Athena can say so instead of guessing.",
    layer: "Scalekit identity, Cognee permissions" },
  { region: "hippocampus", regionLabel: "Hippocampus", god: "Mnemosyne",
    inYou: "The seahorse-shaped structure where new memories are formed and indexed before they settle into the cortex.",
    inPantheon: "Pulls every system of record your company lives in, pulled as you, through 400+ Scalekit connectors; the more you connect, the better the brain. Every node is tagged with its source, channel and owner.",
    layer: "Scalekit pull, Cognee remember" },
  { region: "prefrontal", regionLabel: "Prefrontal cortex", god: "Athena",
    inYou: "The front of the brain. Planning, reasoning, holding several facts in mind at once and weighing them.",
    inPantheon: "Recalls the scoped passages, stitches facts across sources into one cited answer, and says plainly what it could not see.",
    layer: "Cognee recall, Respan model routing" },
  { region: "motor", regionLabel: "Motor cortex", god: "Hephaestus",
    inYou: "The strip across the top of the brain that turns intention into movement.",
    inPantheon: "Acts on request and proposes follow-ups: a Slack message, a GitHub issue, a request for access. You approve, decline or revise, and it remembers your decisions. Allow-listed writes, never destructive.",
    layer: "Scalekit execute as user" },
  { region: "orbitofrontal", regionLabel: "Orbitofrontal cortex", god: "Themis",
    inYou: "Just above the eyes. It values outcomes and learns whether a decision was good after the fact.",
    inPantheon: "The independent judge. A deterministic fact check plus a pinned cheap model that is not the one Athena answers with. Scores every run, before and after a change.",
    layer: "Respan evals" },
  { region: "sleep", regionLabel: "Sleep", god: "Morpheus",
    inYou: "Not a region but a state. During sleep the brain replays the day and consolidates what matters into long-term memory.",
    inPantheon: "Consolidation. Runs Cognee's improve pass over the graph so tomorrow's answers are better than today's.",
    layer: "Cognee improve" },
];
```

```tsx
// web/components/landing/Reveal.tsx
"use client";
import { motion, useReducedMotion } from "motion/react";
export function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} initial={reduce ? false : { opacity: 0.35, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  );
}
```

```tsx
// web/components/landing/Nav.tsx
import Link from "next/link";
export function Nav() {
  return (
    <nav className="flex h-[72px] items-center justify-between gap-6">
      <Link href="/" className="flex items-center gap-3 font-serif text-[22px] font-semibold uppercase tracking-[0.06em]">
        <span className="relative inline-block h-[26px] w-[26px] rounded-full border-[1.5px] border-accent after:absolute after:inset-[6px] after:rounded-full after:bg-accent" />Pantheon
      </Link>
      <ul className="hidden gap-8 text-[13.5px] text-fg-2 md:flex">
        {[["#pantheon", "The brain"], ["#access", "Access"], ["#layers", "Layers"], ["#evaluation", "Evaluation"]].map(([h, l]) => <li key={h}><a href={h}>{l}</a></li>)}
      </ul>
      <Link href="/app" className="btn btn-sm btn-primary">Open the app</Link>
    </nav>
  );
}
```

```tsx
// web/components/landing/Hero.tsx
"use client";
import type { RegionName } from "@/lib/brain/geometry";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";

// Loaded after hydration so the headline is the LCP element, not the WebGL canvas.
const Brain = dynamic(() => import("@/components/Brain").then((m) => m.Brain), { ssr: false, loading: () => <div className="h-full w-full bg-bg" /> });

const GOD: Record<RegionName, string> = { thalamus: "Hermes", amygdala: "Cerberus", hippocampus: "Mnemosyne", prefrontal: "Athena", motor: "Hephaestus", orbitofrontal: "Themis", sleep: "Morpheus" };

export function Hero() {
  const [r, setR] = useState<RegionName>("thalamus");
  return (
    <header className="grid min-h-[600px] items-center gap-8 py-12 pb-18 lg:grid-cols-[minmax(0,560px)_1fr]">
      <div>
        <p className="insc">A company brain, run by gods</p>
        <h1 className="mt-4 text-[clamp(44px,6vw,86px)]">It knows your company. It only tells you <em className="italic text-accent">what you may know.</em></h1>
        <p className="mt-6 max-w-[38ch] text-lg leading-snug text-fg-2">Reads every system your company lives in, as each employee. Remembers per person. Answers with sources. No shared bot token.</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/app" className="btn btn-primary">Open the app</Link>
          <a href="https://github.com/UJameel/company-brain-hackathon" target="_blank" rel="noreferrer" className="btn">View on GitHub</a>
        </div>
      </div>
      <div className="relative order-first aspect-[1.15] w-full max-w-[520px] lg:order-none lg:max-w-none">
        <Brain mode="autoplay" onRegion={setR} className="h-full w-full" />
        <div className="absolute bottom-0 left-0 font-mono text-[11px] text-muted">{r} · {GOD[r]}</div>
      </div>
    </header>
  );
}
```

```tsx
// web/components/landing/Problem.tsx
import { Reveal } from "./Reveal";
export function Problem() {
  return (
    <section className="border-t border-line py-28">
      <Reveal><h2 className="max-w-[26ch] text-[clamp(34px,4.4vw,60px)]">Every brain bot today reads your company with one token that sees everything.</h2></Reveal>
      <Reveal><p className="mt-4 max-w-[56ch] text-[17px] text-fg-2">So either it leaks the leadership channel to a contractor, or you never connect the leadership channel. Pantheon pulls, remembers and answers as the person asking.</p></Reveal>
      <div className="mt-12 grid gap-12 md:grid-cols-2">
        <Reveal className="max-w-[46ch] border-t border-line-2 pt-4 text-fg-2"><b className="mb-2 block font-serif text-2xl font-semibold text-fg">The knowledge is already scattered.</b>The launch date is in one channel, the price change in another, the blocker in an issue, the plan in a wiki page. Nobody holds the whole picture.</Reveal>
        <Reveal className="max-w-[46ch] border-t border-line-2 pt-4 text-fg-2" delay={0.1}><b className="mb-2 block font-serif text-2xl font-semibold text-fg">Access is the product.</b>Alice and Bob ask the same question and get different, correct answers. The brain tells Bob what exists that he can&apos;t read, and who owns it.</Reveal>
      </div>
    </section>
  );
}
```

```tsx
// web/components/landing/Pantheon.tsx
"use client";
import { AGENTS } from "@/data/agents";
import type { RegionName } from "@/lib/brain/geometry";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const Brain = dynamic(() => import("@/components/Brain").then((m) => m.Brain), { ssr: false, loading: () => <div className="h-full w-full bg-bg" /> });

export function Pantheon() {
  const [active, setActive] = useState<RegionName>("thalamus");
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setActive((e.target as HTMLElement).dataset.region as RegionName);
    }, { rootMargin: "-40% 0px -40% 0px", threshold: 0 });
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);
  const a = AGENTS.find((x) => x.region === active)!;
  return (
    <section id="pantheon" className="border-t border-line py-28">
      <p className="insc">The pantheon</p>
      <h2 className="mt-4 max-w-[20ch] text-[clamp(34px,4.4vw,60px)]">Seven agents. Seven regions of one brain.</h2>
      <p className="mt-4 max-w-[56ch] text-[17px] text-fg-2">Each agent does the job its region does in you. Scroll, and the region lights.</p>
      <div className="mt-10 grid gap-12 lg:grid-cols-2">
        <div className="sticky top-16 aspect-[1.1] max-h-[80vh] self-start bg-bg lg:top-16">
          <Brain mode="scroll" activeRegion={active} className="h-full w-full" />
          <div className="pointer-events-none absolute left-0 top-0 grid gap-1"><span className="insc text-[12px]">{a.god}</span><span className="font-serif text-3xl leading-none">{a.regionLabel}</span></div>
        </div>
        <div>
          {AGENTS.map((ag, i) => (
            <div key={ag.region} data-region={ag.region} ref={(el) => { refs.current[i] = el; }}
              className={`flex min-h-[62vh] flex-col justify-center border-t border-line py-10 transition-opacity duration-300 first:border-t-0 ${active === ag.region ? "opacity-100" : "opacity-40"}`}>
              <div className="font-serif text-[clamp(40px,4.5vw,64px)] leading-none"><small className="mb-3 block font-serif text-[13px] font-semibold uppercase tracking-[0.22em] text-accent">{ag.regionLabel}</small>{ag.god}</div>
              <p className="mt-5 max-w-[48ch] text-fg-2"><b className="font-medium text-fg">In you:</b> {ag.inYou}</p>
              <p className="mt-3.5 max-w-[48ch] text-fg"><b className="font-medium">In Pantheon:</b> {ag.inPantheon}</p>
              <p className="mt-4 font-mono text-[11.5px] tracking-[0.04em] text-muted">layer <b className="font-medium text-accent">{ag.layer}</b></p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

```tsx
// web/components/landing/AccessStory.tsx
import { Reveal } from "./Reveal";
const BEATS = [
  { k: "before", h: "Isolation", p: "Bob is a contractor with Slack only. He asks about the Atlas launch risk.", ex: ["Cerberus: bob may read ['bob-brain']; hidden ['alice-brain']", "Athena: 3 passages from ['source:slack']", "~October 28 fallback: not in Bob's answer"] },
  { k: "the grant", h: "Alice shares", p: "Alice grants Bob read on her dataset. Cognee records the permission, performed as Alice.", ex: ["cerberus.grant(owner=\"alice\", to=\"bob\")", "*alice granted read on alice-brain to bob"], lit: true },
  { k: "after", h: "Changed result", p: "Same question, re-asked. Bob's answer is grounded in GitHub too, and the eval moves.", ex: ["Cerberus: bob may read ['alice-brain', 'bob-brain']", "Athena: 7 passages from ['source:github', 'source:slack']", "*coverage 0.89 to 1.00"] },
];
export function AccessStory() {
  return (
    <section id="access" className="border-t border-line py-28">
      <Reveal><h2 className="max-w-[20ch] text-[clamp(34px,4.4vw,60px)]">Isolation, then a grant, then the answer changes.</h2></Reveal>
      <Reveal><p className="mt-4 max-w-[56ch] text-[17px] text-fg-2">Each person&apos;s dataset holds only what their own connections could pull. One permission write, made as the owner, changes what the brain will say.</p></Reveal>
      <div className="mt-14 grid gap-px border border-line bg-line md:grid-cols-3">
        {BEATS.map((b, i) => (
          <Reveal key={b.k} delay={i * 0.08} className={`flex flex-col gap-4 bg-bg p-7 ${b.lit ? "bg-[linear-gradient(180deg,var(--accent-dim),transparent_60%)]" : ""}`}>
            <h3 className="text-3xl"><span className="mb-2.5 block font-mono text-[11px] font-normal uppercase tracking-[0.14em] text-muted">{b.k}</span>{b.h}</h3>
            <p className="max-w-[40ch] text-[14.5px] text-fg-2">{b.p}</p>
            <div className="mt-auto overflow-x-auto border border-line bg-bg-2 px-3.5 py-3 font-mono text-[12px] leading-relaxed text-fg-2">
              {b.ex.map((l) => l.startsWith("*") ? <div key={l} className="text-accent">{l.slice(1)}</div> : l.startsWith("~") ? <s key={l} className="text-muted">{l.slice(1)}</s> : <div key={l}>{l}</div>)}
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
```

```tsx
// web/components/landing/Layers.tsx
import { Reveal } from "./Reveal";
const LAYERS = [
  ["Scalekit", "identity and connections", "Pulls from every system of record through the user's own connected accounts, 400+ connectors, and takes actions as them. No shared tokens anywhere."],
  ["Cognee", "memory", "One knowledge graph per person, tagged by source, channel and owner. Backend access control decides what each recall may read."],
  ["Respan", "gateway, traces, evals", "Every model call goes through the gateway. Every run is a traced workflow. Themis scores runs before and after a change."],
];
export function Layers() {
  return (
    <section id="layers" className="border-t border-line py-28">
      <Reveal><h2 className="max-w-[20ch] text-[clamp(34px,4.4vw,60px)]">Three layers, each doing one job.</h2></Reveal>
      <div className="mt-14 grid gap-10 md:grid-cols-3">
        {LAYERS.map(([name, role, body], i) => (
          <Reveal key={name} delay={i * 0.08} className="border-t border-line-2 pt-5">
            <div className="font-serif text-3xl font-semibold leading-none">{name}</div>
            <div className="my-3 font-mono text-[11px] uppercase tracking-[0.12em] text-accent">{role}</div>
            <p className="text-[14.5px] text-fg-2">{body}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
```

```tsx
// web/components/landing/Evaluation.tsx
import evals from "@/data/evals.json";
import Link from "next/link";
import { Reveal } from "./Reveal";
export function Evaluation() {
  const e = evals as { before: { mean: number } | null; after: { mean: number } | null; isolation: { mean: number } | null };
  const Num = ({ v, l, lit }: { v: number | undefined; l: string; lit?: boolean }) => (
    <div className="bg-bg p-7"><div className={`font-serif text-[96px] leading-[0.9] tracking-[-0.02em] ${lit ? "text-accent" : ""}`}>{v?.toFixed(2) ?? "n/a"}</div><div className="mt-3.5 font-mono text-[13px] text-muted">{l}</div></div>
  );
  return (
    <section id="evaluation" className="border-t border-line py-28">
      <Reveal><h2 className="max-w-[20ch] text-[clamp(34px,4.4vw,60px)]">Scored before and after, by a judge that is not the agent.</h2></Reveal>
      <div className="mt-14 grid gap-px border border-line bg-line md:grid-cols-[1fr_1fr_1.6fr]">
        <Num v={e.isolation?.mean} l="isolation run, 15 scenarios, zero leaks" />
        <Num v={e.before?.mean} l="coverage before the share" />
        <div className="flex flex-col justify-between gap-5 bg-bg p-7">
          <div><div className="font-serif text-[96px] leading-[0.9] text-accent">{e.after?.mean.toFixed(2) ?? "n/a"}</div><div className="mt-3.5 font-mono text-[13px] text-muted">after the grant</div></div>
          <p className="max-w-[46ch] text-[15px] text-fg-2">Themis runs a deterministic fact check and a pinned judge on a different model from the one Athena answers with. Scores are attached to the Respan trace of every run.</p>
          <Link href="/app/evals" className="btn btn-sm self-start">See every scenario</Link>
        </div>
      </div>
    </section>
  );
}
```

```tsx
// web/components/landing/Quickstart.tsx
"use client";
import { useState } from "react";
const CMDS = `git clone https://github.com/UJameel/company-brain-hackathon && cd company-brain-hackathon
uv venv --python 3.12 .venv && source .venv/bin/activate
uv pip install cognee scalekit-sdk-python openai python-dotenv respan-ai pytest
python -m pantheon ingest
python -m pantheon eval --label before-coverage && python -m pantheon grant --owner alice --to bob
python -m pantheon eval --label after --stage after-grant && python -m pantheon compare before-coverage after`;
export function Quickstart() {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(CMDS); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ } };
  return (
    <section className="border-t border-line py-28">
      <h2 className="max-w-[20ch] text-[clamp(34px,4.4vw,60px)]">Clone to eval score in six commands.</h2>
      <div className="relative mt-12">
        <pre className="overflow-x-auto border border-line bg-bg-2 px-6 py-5 font-mono text-[13px] leading-[1.75] text-fg-2">{CMDS}</pre>
        <button onClick={copy} className="btn btn-sm absolute right-3 top-3">{copied ? "Copied" : "Copy"}</button>
      </div>
    </section>
  );
}
```

```tsx
// web/components/landing/Footer.tsx
export function Footer() {
  return (
    <footer className="flex flex-wrap justify-between gap-4 border-t border-line py-9 text-[13px] text-muted">
      <span>Built for the Scalekit, Cognee and Respan Company Brain hackathon, SF Tech Week 2026.</span>
      <a href="https://github.com/UJameel/company-brain-hackathon" target="_blank" rel="noreferrer">github.com/UJameel/company-brain-hackathon</a>
    </footer>
  );
}
```

```tsx
// web/app/page.tsx
import { AccessStory } from "@/components/landing/AccessStory";
import { Evaluation } from "@/components/landing/Evaluation";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { Layers } from "@/components/landing/Layers";
import { Nav } from "@/components/landing/Nav";
import { Pantheon } from "@/components/landing/Pantheon";
import { Problem } from "@/components/landing/Problem";
import { Quickstart } from "@/components/landing/Quickstart";

export default function Home() {
  return (
    <div className="mx-auto max-w-[1280px] px-[clamp(16px,4vw,56px)]" style={{ backgroundImage: "radial-gradient(90% 60% at 50% 0%, rgba(200,96,44,.08), transparent 60%)" }}>
      <Nav /><Hero /><Problem /><Pantheon /><AccessStory /><Layers /><Evaluation /><Quickstart /><Footer />
    </div>
  );
}
```

- [ ] **Step 4: Run tests, then check the page at two widths**

Run: `pnpm test`; open `/` at 1440 and at 390 (device toolbar).
Expected: 25 passed. Hero headline, subtext and both CTAs visible without scrolling at 1440x900. At 390 no horizontal scroll. Scrolling through the pantheon section orbits the brain to each region and the label follows.

- [ ] **Step 5: Commit**

```bash
git add web/app/page.tsx web/components/landing web/data/agents.ts web/data/agents.test.ts
git commit -m "web: landing page with 3D brain scrollytelling"
```

---

### Task 11: Graph view (tier 2)

**Files:**
- Create: `web/lib/brain/layout.worker.ts`, `web/lib/brain/layout.ts`, `web/components/app/GraphView.tsx`, `web/app/app/graph/page.tsx`
- Test: `web/lib/brain/layout.test.ts`

**Interfaces:**
- Produces: `fitToVolume(positions: Vec3[], padding = 0.9) -> Vec3[]` scaling and centring arbitrary positions into the box `[-0.62, 0.62] x [-0.48, 0.48] x [-0.5, 0.5]` times `padding`; `layoutGraph(graph: Graph) -> Promise<Graph & {nodes: (GraphNode & {x, y, z})[]}>` running `d3-force-3d` for 300 ticks in a Web Worker and applying `fitToVolume`; `sourceTone(tag: string, order: string[]) -> number` giving a stable index by first appearance; `<GraphView />` page component with a dataset list, a source legend and a search box that calls `api.ask` and lights nodes whose label appears in the returned passages' text (via `highlight` terms from the answer's cited sources).

- [ ] **Step 1: Write the failing test**

```ts
// web/lib/brain/layout.test.ts
import { describe, expect, it } from "vitest";
import { fitToVolume, sourceTone } from "./layout";

describe("layout", () => {
  it("fits positions into the brain volume", () => {
    const out = fitToVolume([[0, 0, 0], [100, 50, -20], [-100, -50, 20]], 1);
    for (const [x, y, z] of out) { expect(Math.abs(x)).toBeLessThanOrEqual(0.62); expect(Math.abs(y)).toBeLessThanOrEqual(0.48); expect(Math.abs(z)).toBeLessThanOrEqual(0.5); }
    expect(out[0]).toEqual([0, 0, 0]);
  });
  it("assigns stable tones by first appearance", () => {
    const order: string[] = [];
    expect(sourceTone("source:slack", order)).toBe(0);
    expect(sourceTone("source:gmail", order)).toBe(1);
    expect(sourceTone("source:slack", order)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL, cannot resolve `./layout`

- [ ] **Step 3: Write the implementation**

```ts
// web/lib/brain/layout.ts
import type { Graph, GraphNode } from "../types";
import type { Vec3 } from "./geometry";

export function fitToVolume(positions: Vec3[], padding = 0.9): Vec3[] {
  if (!positions.length) return [];
  const max = [0, 0, 0];
  for (const p of positions) for (let i = 0; i < 3; i++) max[i] = Math.max(max[i], Math.abs(p[i]));
  const box = [0.62, 0.48, 0.5];
  const s = Math.min(...box.map((b, i) => (max[i] ? (b * padding) / max[i] : 1)));
  return positions.map(([x, y, z]) => [x * s, y * s, z * s]);
}

export function sourceTone(tag: string, order: string[]): number {
  let i = order.indexOf(tag);
  if (i < 0) { order.push(tag); i = order.length - 1; }
  return i;
}

export type LaidOut = Graph & { nodes: (GraphNode & { x: number; y: number; z: number })[] };

export function layoutGraph(graph: Graph): Promise<LaidOut> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./layout.worker.ts", import.meta.url));
    worker.onmessage = (e: MessageEvent<Vec3[]>) => {
      const fitted = fitToVolume(e.data);
      resolve({ ...graph, nodes: graph.nodes.map((n, i) => ({ ...n, x: fitted[i][0], y: fitted[i][1], z: fitted[i][2] })) });
      worker.terminate();
    };
    worker.onerror = (e) => { reject(e); worker.terminate(); };
    worker.postMessage(graph);
  });
}
```

```ts
// web/lib/brain/layout.worker.ts
import { forceCenter, forceLink, forceManyBody, forceSimulation } from "d3-force-3d";
import type { Graph } from "../types";

self.onmessage = (e: MessageEvent<Graph>) => {
  const nodes = e.data.nodes.map((n) => ({ id: n.id }));
  const links = e.data.edges.map((l) => ({ source: l.source, target: l.target }));
  const sim = forceSimulation(nodes, 3).force("charge", forceManyBody().strength(-8)).force("link", forceLink(links).id((d: { id: string }) => d.id).distance(12)).force("center", forceCenter()).stop();
  for (let i = 0; i < 300; i++) sim.tick();
  postMessage(nodes.map((n) => [(n as { x: number }).x, (n as { y: number }).y, (n as { z: number }).z]));
};
```

```tsx
// web/components/app/GraphView.tsx
"use client";
import { Brain } from "@/components/Brain";
import { api } from "@/lib/api";
import { layoutGraph, sourceTone, type LaidOut } from "@/lib/brain/layout";
import { useSession } from "@/lib/session";
import { useEffect, useMemo, useState } from "react";

export function GraphView() {
  const s = useSession();
  const [g, setG] = useState<LaidOut | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (s.mode !== "live") return;
    setG(null); setErr(null);
    api.graph(s.user).then(layoutGraph).then(setG).catch((e) => setErr((e as Error).message));
  }, [s.user, s.mode, s.grants]);
  const sources = useMemo(() => { const order: string[] = []; g?.nodes.forEach((n) => n.node_set.filter((t) => t.startsWith("source:")).forEach((t) => sourceTone(t, order))); return order; }, [g]);
  const datasets = useMemo(() => { const m = new Map<string, number>(); g?.nodes.forEach((n) => m.set(n.dataset ?? "?", (m.get(n.dataset ?? "?") ?? 0) + 1)); return [...m]; }, [g]);
  if (s.mode !== "live") return <div className="p-6 text-fg-2">The graph view needs the live API. In recorded mode there is no graph to draw.</div>;
  return (
    <div className="grid h-full lg:grid-cols-[260px_1fr]">
      <aside className="border-r border-line p-5 font-mono text-[12px]">
        <div className="insc mb-3 text-[11px]">Datasets {s.user} can read</div>
        {datasets.map(([d, n]) => <div key={d} className="flex justify-between py-1 text-fg-2"><span>{d}</span><span className="num">{n}</span></div>)}
        <div className="insc mb-3 mt-6 text-[11px]">Sources</div>
        {sources.map((t) => <div key={t} className="py-1 text-fg-2">{t}</div>)}
        {err && <p className="mt-6 text-muted">Could not load the graph: {err}</p>}
        {!g && !err && <p className="mt-6 text-muted">Laying out the graph</p>}
        {g && <p className="mt-6 text-muted">{g.nodes.length} nodes · {g.edges.length} edges</p>}
      </aside>
      <div className="relative min-h-[480px]">{g && <Brain mode="graph" graph={g} activeRegion="sleep" className="h-full w-full" />}</div>
    </div>
  );
}
```

```tsx
// web/app/app/graph/page.tsx
import { GraphView } from "@/components/app/GraphView";
export default function GraphPage() { return <GraphView />; }
```

- [ ] **Step 4: Run tests and, with the API live, open `/app/graph`**

Run: `pnpm test`; with `NEXT_PUBLIC_PANTHEON_API` set and the API up, open `/app/graph` as Alice then Bob.
Expected: 27 passed; Alice's graph has more nodes than Bob's; after a grant on the chat page, Bob's graph reloads larger.

- [ ] **Step 5: Commit**

```bash
git add web/lib/brain/layout.ts web/lib/brain/layout.worker.ts web/lib/brain/layout.test.ts web/components/app/GraphView.tsx web/app/app/graph
git commit -m "web: real knowledge graph view inside the brain"
```

---

### Task 12: Connections page (tier 2), Vercel, e2e

**Files:**
- Create: `web/components/app/ConnectionsView.tsx`, `web/app/app/connections/page.tsx`, `web/playwright.config.ts`, `web/e2e/app.spec.ts`, `web/e2e/landing.spec.ts`, `web/vercel.json`

**Interfaces:**
- Consumes: `api.connections`, `api.sync`, `useSession`.
- Produces: `<ConnectionsView />` listing every connection the API reports (the backend is generalising to any Scalekit connector; render whatever comes back, never a fixed three), with Connect links and a Sync form (`channels`, `github_repo`, `notion_query` prefilled from the demo script, plus an "all sources" checkbox mapped to `all_sources: true`).

- [ ] **Step 1: Write the e2e tests (they fail until the pages exist)**

```ts
// web/playwright.config.ts
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e", timeout: 30_000,
  use: { baseURL: "http://localhost:3000", screenshot: "only-on-failure" },
  webServer: { command: "pnpm dev", url: "http://localhost:3000", reuseExistingServer: true, env: { NEXT_PUBLIC_PANTHEON_API: "" } },
  projects: [{ name: "desktop", use: { viewport: { width: 1440, height: 900 } } }, { name: "phone", use: { viewport: { width: 390, height: 844 } } }],
});
```

```ts
// web/e2e/landing.spec.ts
import { expect, test } from "@playwright/test";

test("hero fits and the page never scrolls sideways", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Open the app" }).first()).toBeInViewport();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  await page.screenshot({ path: `e2e/out/landing-${test.info().project.name}.png`, fullPage: false });
});

test("scrolling the pantheon lights each agent label", async ({ page }) => {
  await page.goto("/#pantheon");
  for (const god of ["Hermes", "Cerberus", "Mnemosyne", "Athena", "Hephaestus", "Themis", "Morpheus"]) {
    await page.locator(`[data-region]`).filter({ hasText: god }).scrollIntoViewIfNeeded();
    await expect(page.locator(".insc").filter({ hasText: god }).first()).toBeVisible();
  }
});
```

```ts
// web/e2e/app.spec.ts
import { expect, test } from "@playwright/test";

test("recorded mode streams a turn with the step rail", async ({ page }) => {
  await page.goto("/app");
  await expect(page.getByText("recorded")).toBeVisible();
  await page.getByRole("button", { name: "Pro plan price" }).click();
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.getByText("Hermes")).toBeVisible();
  await expect(page.getByText(/model calls/)).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: `e2e/out/app-${test.info().project.name}.png` });
});

test("compare renders two answers side by side", async ({ page }) => {
  await page.goto("/app");
  await page.getByLabel("Compare both").check();
  await page.getByRole("button", { name: "Pro plan price" }).click();
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.locator("article")).toHaveCount(2, { timeout: 15_000 });
  await expect(page.getByText(/dataset.* you can't see/)).toBeVisible();
});

test("unknown question in recorded mode explains itself", async ({ page }) => {
  await page.goto("/app");
  await page.getByLabel("Ask the brain").fill("Who is on call tonight?");
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.getByText(/No recorded answer/)).toBeVisible();
});
```

- [ ] **Step 2: Run e2e to verify the connections-free parts pass and note the baseline**

Run: `pnpm exec playwright install chromium` once, then `pnpm e2e`.
Expected: the landing and app specs pass on both projects (they only need Tasks 1 to 10). Screenshots land in `web/e2e/out/`.

- [ ] **Step 3: Write the connections page**

```tsx
// web/components/app/ConnectionsView.tsx
"use client";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { Connection } from "@/lib/types";
import { useEffect, useState } from "react";

export function ConnectionsView() {
  const s = useSession();
  const [rows, setRows] = useState<Connection[] | null>(null);
  const [form, setForm] = useState({ channels: "#general,#engineering", github_repo: "UJameel/northwind-atlas", notion_query: "Atlas Launch Plan", all: true });
  const [log, setLog] = useState<string | null>(null);
  const load = () => { if (s.mode === "live") api.connections(s.user).then(setRows).catch((e) => setLog((e as Error).message)); };
  useEffect(load, [s.user, s.mode]);
  const sync = async () => {
    setLog("Mnemosyne is pulling as " + s.user + ". This takes a while; chat for this user waits.");
    try {
      const r = await api.sync({ user: s.user, channels: form.channels.split(",").map((c) => c.trim()).filter(Boolean), github_repo: form.github_repo || null, notion_query: form.notion_query || null, all_sources: form.all });
      setLog(`Remembered ${String(r.documents ?? "?")} documents into ${String(r.dataset ?? "")} from ${(r.sources as string[] | undefined)?.join(", ") ?? "recorded data"}.`);
    } catch (e) { setLog("Sync failed: " + (e as Error).message); }
    load();
  };
  if (s.mode !== "live") return <div className="p-6 text-fg-2">Connections need the live API and a Scalekit workspace.</div>;
  return (
    <div className="max-w-3xl space-y-8 p-6">
      <section>
        <h2 className="text-3xl">Connected as {s.user}</h2>
        <p className="mt-2 text-sm text-fg-2">Each person links their own accounts. Pantheon only ever reads what these accounts can read.</p>
        <ul className="mt-5 divide-y divide-line border-y border-line font-mono text-[12.5px]">
          {(rows ?? []).map((c) => (
            <li key={c.connection} className="grid grid-cols-[1fr_auto_auto_88px] items-center gap-3 py-3">
              <span>{c.connection}{c.provider && c.provider !== c.connection ? <span className="text-muted"> · {c.provider}</span> : null}</span>
              <span className="text-muted">{c.adapter === "known" ? "adapter" : "generic"}</span>
              <span className={c.status === "ACTIVE" ? "text-accent" : "text-muted"}>{c.status ?? "unknown"}</span>
              {c.link ? <a className="btn btn-sm" href={c.link} target="_blank" rel="noreferrer">Connect</a> : <span />}
            </li>
          ))}
          {rows && rows.length === 0 && <li className="py-3 text-muted">{s.user} has connected nothing yet. The brain only holds what this person can pull.</li>}
        </ul>
      </section>
      <section>
        <h2 className="text-3xl">Sync now</h2>
        <div className="mt-4 grid gap-3 text-sm">
          {([["channels", "Slack channels"], ["github_repo", "GitHub repo"], ["notion_query", "Notion search"]] as const).map(([k, label]) => (
            <label key={k} className="grid gap-1"><span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{label}</span>
              <input id={`sync-${k}`} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="border border-line-2 bg-bg px-3 py-2 text-fg focus:border-accent focus:outline-none" /></label>
          ))}
          <label className="flex items-center gap-2 font-mono text-[11px] text-fg-2"><input id="sync-all" type="checkbox" checked={form.all} onChange={(e) => setForm({ ...form, all: e.target.checked })} />Every connector this user has authorised</label>
          <button onClick={sync} className="btn btn-primary self-start">Pull as {s.user}</button>
          {log && <p className="font-mono text-[12px] text-fg-2">{log}</p>}
        </div>
      </section>
    </div>
  );
}
```

```tsx
// web/app/app/connections/page.tsx
import { ConnectionsView } from "@/components/app/ConnectionsView";
export default function ConnectionsPage() { return <ConnectionsView />; }
```

- [ ] **Step 4: Vercel config and deploy**

```json
// web/vercel.json
{ "framework": "nextjs", "installCommand": "pnpm install", "buildCommand": "pnpm build" }
```

In the Vercel dashboard (Usman connects the GitHub repo): Root Directory `web`, Production Branch `worktree-web` until merged, env `NEXT_PUBLIC_PANTHEON_API=https://pantheon-api.fly.dev` and `NEXT_PUBLIC_DEMO_KEY=<the Fly DEMO_KEY>`. Then on Fly: `fly secrets set WEB_ORIGIN=https://<project>.vercel.app`. Run `pnpm build` locally first and fix any type error it reports.

- [ ] **Step 5: Lighthouse and final e2e**

Run: `pnpm build && pnpm start` then `npx lighthouse http://localhost:3000 --preset=desktop --only-categories=performance --quiet --chrome-flags="--headless" --output=json --output-path=e2e/out/lighthouse.json && node -e 'console.log(require("./e2e/out/lighthouse.json").categories.performance.score*100)'`.
Expected: above 85. If below, the usual fix is the brain mounting before hydration completes; confirm the `Brain` import in `Hero` is dynamic with `ssr: false` and a poster `div` with the `bg-bg` class sits underneath.

Run: `pnpm e2e`
Expected: all specs pass on desktop and phone.

- [ ] **Step 6: Commit**

```bash
git add web/components/app/ConnectionsView.tsx web/app/app/connections web/playwright.config.ts web/e2e web/vercel.json
git commit -m "web: connections page, Playwright e2e, Vercel config"
```
