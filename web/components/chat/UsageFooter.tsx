"use client";
import type { Result } from "@/lib/types";
import { useState } from "react";

/* The developer details: models, tokens, cost, latency. Collapsed by default. */
export function UsageFooter({ result }: { result: Result }) {
  const [open, setOpen] = useState(false);
  const tokens = result.usage.reduce((n, u) => n + (u.prompt_tokens ?? 0) + (u.completion_tokens ?? 0), 0);
  return (
    <div className="mt-3 border-t border-line pt-2 font-mono text-[11px] text-muted">
      <button onClick={() => setOpen(!open)} className="flex w-full justify-between hover:text-fg-2" aria-expanded={open}>
        <span>{open ? "Hide details" : "Details"}</span><span>{result.latency_s.toFixed(1)} s</span>
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-[1fr_auto_auto] gap-x-3.5 gap-y-1">
          {result.usage.map((u, i) => (
            <div key={i} className="contents"><span>{u.step} · {u.provider ? `${u.provider}/` : ""}{u.model}{u.fallback ? " (fallback)" : ""}</span><span className="num text-right">{u.prompt_tokens ?? 0} / {u.completion_tokens ?? 0}</span><span className="num text-right">{u.provider?.startsWith("ollama") ? "$0" : ""}</span></div>
          ))}
          <div className="contents"><span>{result.usage.length} model calls</span><span className="num text-right">{tokens.toLocaleString()} tokens</span><span className="num text-right">est. ${result.cost_usd.toFixed(4)}</span></div>
          {result.feed.map((f, i) => <div key={`f${i}`} className="col-span-3 text-fg-2/70">{f}</div>)}
        </div>
      )}
    </div>
  );
}
