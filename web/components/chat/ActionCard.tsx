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
