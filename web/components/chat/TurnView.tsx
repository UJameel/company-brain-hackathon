"use client";
import type { Turn } from "@/lib/chat";
import { highlight } from "@/lib/highlight";
import type { Proposal } from "@/lib/types";
import { useEffect, useState } from "react";
import { ActionCard } from "./ActionCard";
import { HiddenCard } from "./HiddenCard";
import { ProposalCard } from "./ProposalCard";
import { StepRail } from "./StepRail";
import { UsageFooter } from "./UsageFooter";

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
        <span className="truncate font-mono text-[11px] text-muted">{turn.question}</span>
      </header>
      <StepRail turn={turn} />
      <div className="border border-line bg-bg px-3.5 py-3 text-[13.5px] leading-relaxed">
        {turn.error ? <span className="text-muted">Something went wrong: {turn.error}</span>
          : parts.map((p, i) => p.hit ? <mark key={i} className="bg-transparent text-accent-hi">{p.text}</mark> : <span key={i}>{p.text}</span>)}
        {!turn.done && !turn.error && <span className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-accent align-text-bottom" />}
      </div>
      {turn.result && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {turn.result.sources.map((src) => <span key={src} className="border border-accent/50 bg-accent-dim px-2 py-0.5 font-mono text-[11px] text-accent">{src}</span>)}
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
