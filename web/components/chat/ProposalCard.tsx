"use client";
import { resultUrl } from "@/lib/actions";
import { api } from "@/lib/api";
import { displayText } from "@/lib/names";
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
  const link = settled ? resultUrl(proposal.result) : null;
  const STATUS: Record<string, string> = { proposed: "waiting for you", executed: "done", "approved-dry-run": "approved (dry run, nothing sent)", declined: "declined", revised: "revised", failed: "failed" };
  const res = (proposal.result ?? {}) as Record<string, unknown>;
  const failure = res.status === "failed" || proposal.status === "failed" ? String(res.error ?? "the connector refused the action") : null;
  return (
    <div className={`mt-3 border px-3 py-2.5 text-[12.5px] ${settled ? "border-line" : "border-accent/50 bg-accent-dim"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-serif text-base font-semibold">{TOOL_LABEL[proposal.tool] ?? proposal.tool}</span>
        <span className="font-mono text-[11px] text-muted">{STATUS[proposal.status] ?? proposal.status}{proposal.as_user ? ` · as ${proposal.as_user}` : ""}</span>
      </div>
      <p className="mt-1 text-fg-2">{displayText(proposal.rationale)}</p>
      {body && <p className="mt-2 text-fg">“{displayText(body)}”</p>}
      {typeof input.title === "string" && <p className="mt-1 font-mono text-[11px] text-muted">title {displayText(input.title)}</p>}
      {typeof input.channel === "string" && <p className="font-mono text-[11px] text-muted">to {displayText(input.channel)}</p>}
      {proposal.tool === "request_access" && typeof input.owner === "string" && <p className="font-mono text-[11px] text-muted">owner {displayText(input.owner)} · dataset {displayText(String(input.dataset ?? ""))}</p>}
      {error && <p className="mt-2 font-mono text-[11px] text-muted">Could not record the decision: {error}</p>}
      {!settled && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button onClick={() => act("approve")} disabled={!!busy || s.mode !== "live"} className="btn btn-sm btn-primary">{busy === "approve" ? "Doing it" : proposal.tool === "github_issue_create" ? "Approve and open it" : "Approve and send it"}</button>
          <button onClick={() => act("decline")} disabled={!!busy || s.mode !== "live"} className="btn btn-sm">{busy === "decline" ? "Declining" : "Decline"}</button>
          <button onClick={() => setRevising(!revising)} disabled={!!busy || s.mode !== "live"} className="btn btn-sm">Revise</button>
          {s.mode !== "live" && <span className="font-mono text-[11px] text-muted">Deciding needs the live brain</span>}
          {revising && (
            <>
              <label htmlFor={`note-${proposal.id}`} className="sr-only">Revision note</label>
              <input id={`note-${proposal.id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should change?" className="min-w-[200px] flex-1 border border-line-2 bg-bg px-2 py-1.5 text-fg placeholder:text-muted focus:border-accent focus:outline-none" />
              <button onClick={() => act("revise")} disabled={!!busy || !note.trim()} className="btn btn-sm">{busy === "revise" ? "Redrafting" : "Send note"}</button>
            </>
          )}
        </div>
      )}
      {failure && <p className="mt-2 font-mono text-[11px] text-muted">Could not do it: {failure}</p>}
      {link && <a className="mt-2 inline-block font-mono text-[11px] text-accent" href={link} target="_blank" rel="noreferrer">{proposal.tool === "github_issue_create" ? "Open on GitHub" : "Open what was sent"}</a>}
    </div>
  );
}
