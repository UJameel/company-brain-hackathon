"use client";
import { api } from "@/lib/api";
import { layoutGraph, sourceTone, type LaidOut } from "@/lib/brain/layout";
import { useSession } from "@/lib/session";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

const Brain = dynamic(() => import("@/components/Brain").then((m) => m.Brain), { ssr: false, loading: () => <div className="h-full w-full bg-bg" /> });

export function GraphView() {
  const s = useSession();
  const [g, setG] = useState<LaidOut | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (s.mode !== "live") return;
    setG(null); setErr(null);
    api.graph(s.user).then(layoutGraph).then(setG).catch((e) => setErr((e as Error).message));
  }, [s.user, s.mode, s.grants]);
  const sources = useMemo(() => { const order: string[] = []; g?.nodes.forEach((n) => n.node_set.filter((t) => t.startsWith("source:")).forEach((t) => sourceTone(t, order))); return order; }, [g]);
  const datasets = useMemo(() => { const m = new Map<string, number>(); g?.nodes.forEach((n) => m.set(n.dataset ?? "?", (m.get(n.dataset ?? "?") ?? 0) + 1)); return [...m]; }, [g]);
  if (s.mode !== "live") return <div className="p-6 text-fg-2">The graph view needs the live API. In recorded mode there is no graph to draw.</div>;
  return (
    <div className="grid h-full lg:grid-cols-[260px_1fr]">
      <aside className="border-r border-line p-5 font-mono text-[12px]">
        <div className="insc mb-3 text-[11px]">Datasets {s.user} can read</div>
        {datasets.map(([d, n]) => <div key={d} className="flex justify-between py-1 text-fg-2"><span>{d}</span><span className="num">{n}</span></div>)}
        <div className="insc mb-3 mt-6 text-[11px]">Sources</div>
        {sources.map((t) => <div key={t} className="py-1 text-fg-2">{t}</div>)}
        {err && <p className="mt-6 text-muted">Could not load the graph: {err}</p>}
        {!g && !err && <p className="mt-6 text-muted">Laying out the graph</p>}
        {g && <p className="mt-6 text-muted">{g.nodes.length} nodes · {g.edges.length} edges</p>}
      </aside>
      <div className="relative min-h-[480px]">{g && <Brain mode="graph" graph={g} activeRegion="sleep" className="h-full w-full" />}</div>
    </div>
  );
}
