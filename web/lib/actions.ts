import type { Action, Proposal, User } from "./types";

/** An explicit request ("open an issue…") that ran as a dry run is a pending proposal on the
 *  backend; show it with the same approve / decline / revise boxes as a suggestion. */
export function proposalFromRequest(user: User, action: Action | null | undefined): Proposal | null {
  if (!action || action.status !== "dry-run" || typeof action.id !== "string") return null;
  return {
    id: action.id, user, as_user: action.as_user ?? "", tool: action.tool, input: (action.input ?? {}) as Record<string, unknown>,
    rationale: "Requested by you. Nothing has been sent yet.", origin: "requested", status: "proposed", parent: null, created_at: "",
  };
}

/** The link to what an executed action produced, wherever the connector put it. */
export function resultUrl(result: unknown): string | null {
  const seen = new Set<unknown>();
  const walk = (v: unknown, depth: number): string | null => {
    if (typeof v === "string" && /^\s*[[{]/.test(v)) { try { v = JSON.parse(v); } catch { return null; } }  // connectors sometimes return JSON as text
    if (!v || typeof v !== "object" || depth > 4 || seen.has(v)) return null;
    seen.add(v);
    const o = v as Record<string, unknown>;
    for (const k of ["html_url", "url", "permalink", "link"]) if (typeof o[k] === "string" && /^https?:\/\//.test(o[k] as string)) return o[k] as string;
    for (const k of Object.keys(o)) { const r = walk(o[k], depth + 1); if (r) return r; }
    return null;
  };
  return walk(result, 0);
}
