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
