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
