"use client";
import { api } from "@/lib/api";
import { layoutGraph, sourceTone, type LaidOut } from "@/lib/brain/layout";
import { displayDataset } from "@/lib/names";
import { recordedGraphFor } from "@/lib/recordedExtras";
import { useSession, useUser } from "@/lib/session";
import { sourceName } from "@/lib/steps";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

const Brain = dynamic(() => import("@/components/Brain").then((m) => m.Brain), { ssr: false, loading: () => <div className="h-full w-full bg-bg" /> });

export function GraphView() {
  const s = useSession(); const me = useUser();
  const [g, setG] = useState<LaidOut | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const granted = s.granted(me);
  const mode = s.mode;
  useEffect(() => {
    if (mode === "checking") return;
    let cancelled = false;
    setG(null); setErr(null);
    const source = mode === "live" ? api.graph(me) : Promise.resolve(recordedGraphFor(me, granted));
    source.then(layoutGraph).then((g) => { if (!cancelled) setG(g); }).catch((e) => { if (!cancelled) setErr((e as Error).message); });
    return () => { cancelled = true; };
  }, [me, mode, granted]);
  const sources = useMemo(() => { const order: string[] = []; g?.nodes.forEach((n) => n.node_set.filter((t) => t.startsWith("source:")).forEach((t) => sourceTone(t, order))); return order; }, [g]);
  const datasets = useMemo(() => { const m = new Map<string, number>(); g?.nodes.forEach((n) => m.set(n.dataset ?? "?", (m.get(n.dataset ?? "?") ?? 0) + 1)); return [...m]; }, [g]);
  return (
    <div className="grid h-full lg:grid-cols-[260px_1fr]">
      <aside className="border-r border-line p-5 font-mono text-[12px]">
        <div className="insc mb-3 text-[11px]">Datasets you can read</div>
        {datasets.map(([d, n]) => <div key={d} className="flex justify-between py-1 text-fg-2"><span>{displayDataset(d)}</span><span className="num">{n}</span></div>)}
        <div className="insc mb-3 mt-6 text-[11px]">Sources</div>
        {sources.map((t) => <div key={t} className="py-1 text-fg-2">{sourceName(t)}</div>)}
        {err && <p className="mt-6 text-muted">Could not load the graph: {err}</p>}
        {!g && !err && <p className="mt-6 text-muted">Laying out the graph</p>}
        {g && <p className="mt-6 text-muted">{g.nodes.length} nodes · {g.edges.length} edges{s.mode === "recorded" ? " · recorded snapshot" : ""}</p>}
      </aside>
      <div className="relative min-h-[480px]">{g && <Brain mode="graph" graph={g} activeRegion="sleep" className="h-full w-full" />}</div>
    </div>
  );
}
