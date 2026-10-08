"use client";
import type { Result } from "@/lib/types";
import { useState } from "react";

export function UsageFooter({ result }: { result: Result }) {
  const [open, setOpen] = useState(false);
  const tokens = result.usage.reduce((n, u) => n + (u.prompt_tokens ?? 0) + (u.completion_tokens ?? 0), 0);
  if (!result.usage.length) return <div className="mt-3 border-t border-line pt-2 text-right font-mono text-[11px] text-muted">{result.latency_s.toFixed(1)} s</div>;
  return (
    <div className="mt-3 border-t border-line pt-2 font-mono text-[11px] text-muted">
      <button onClick={() => setOpen(!open)} className="flex w-full justify-between hover:text-fg-2">
        <span>{result.usage.length} model calls · {tokens.toLocaleString()} tokens · est. ${result.cost_usd.toFixed(4)}</span><span>{result.latency_s.toFixed(1)} s</span>
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-[1fr_auto_auto] gap-x-3.5 gap-y-1">
          {result.usage.map((u, i) => (
            <div key={i} className="contents"><span>{u.step} · {u.provider ? `${u.provider}/` : ""}{u.model}{u.fallback ? " (fallback)" : ""}</span><span className="num text-right">{u.prompt_tokens ?? 0} / {u.completion_tokens ?? 0}</span><span className="num text-right">{u.provider === "ollama" ? "$0" : ""}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}
