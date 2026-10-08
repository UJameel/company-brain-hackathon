"use client";
import { useState } from "react";

export const SCENARIOS = [
  { label: "What's blocking PR #3?", q: "What is blocking PR #3, who owns it, and which issue tracks the blocker?" },
  { label: "What will Pro cost after launch?", q: "What will the Pro plan cost after the Atlas launch?" },
  { label: "Is the launch date at risk?", q: "Is the Atlas launch date at risk? If so, what is the fallback date and the deadline that decides it?" },
  { label: "Open an issue for the $59 price", q: "Open a GitHub issue asking Bob to switch the pricing page to $59 on launch day, October 21." },
];

export function Composer({ busy, onSend }: { busy: boolean; onSend: (q: string) => void }) {
  const [q, setQ] = useState("");
  const send = () => { const v = q.trim(); if (v && !busy) { onSend(v); setQ(""); } };
  return (
    <div className="border-t border-line bg-bg-2 p-4">
      <div className="mb-2 flex flex-wrap gap-2">
        {SCENARIOS.map((s) => <button key={s.label} onClick={() => setQ(s.q)} className="border border-line-2 px-2.5 py-1 text-[12px] text-fg-2 hover:border-accent hover:text-accent">{s.label}</button>)}
      </div>
      <div className="flex gap-2">
        <label htmlFor="composer" className="sr-only">Ask the brain</label>
        <input id="composer" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ask the brain, or answer a suggestion: yes, no, make it shorter"
          className="min-w-0 flex-1 border border-line-2 bg-bg px-3 py-2 text-fg placeholder:text-muted focus:border-accent focus:outline-none" />
        <button onClick={send} disabled={busy} className="btn btn-sm btn-primary">{busy ? "Thinking" : "Ask"}</button>
      </div>
    </div>
  );
}
