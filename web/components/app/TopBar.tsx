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
