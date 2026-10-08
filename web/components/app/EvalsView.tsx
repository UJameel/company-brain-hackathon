"use client";
import recorded from "@/data/evals.json";
import { api } from "@/lib/api";
import { pairRows } from "@/lib/evals";
import { useSession } from "@/lib/session";
import { PEOPLE } from "@/lib/names";
import type { Evals, User } from "@/lib/types";
import { useEffect, useState } from "react";

function Num({ v, label, lit }: { v: number | null | undefined; label: string; lit?: boolean }) {
  return (
    <div className="border border-line bg-bg-2 p-6"><div className={`font-serif text-7xl leading-none ${lit ? "text-accent" : ""}`}>{v == null ? "n/a" : v.toFixed(2)}</div><div className="mt-3 font-mono text-[12px] text-muted">{label}</div></div>
  );
}

export function EvalsView() {
  const s = useSession();
  const [ev, setEv] = useState<Evals | null>(null);
  useEffect(() => {
    if (s.mode === "live") api.evals().then(setEv).catch(() => setEv(recorded as unknown as Evals));
    else if (s.mode === "recorded") setEv(recorded as unknown as Evals);
  }, [s.mode]);
  if (!ev) return <div className="p-6 font-mono text-[12px] text-muted">Loading evals</div>;
  const rows = pairRows(ev.before, ev.after);
  return (
    <div className="space-y-6 p-6">
      <div className="grid gap-3 md:grid-cols-3">
        <Num v={ev.isolation?.mean} label="isolation run, zero leaks expected" />
        <Num v={ev.before?.mean} label="coverage before the share" />
        <Num v={ev.after?.mean} label={`after · ${ev.change}`} lit />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-mono text-[12px]">
          <thead><tr className="text-left text-muted"><th className="py-2 pr-3 font-normal">scenario</th><th className="font-normal">as</th><th className="text-right font-normal">before</th><th className="text-right font-normal">after</th><th className="pl-3 font-normal">notes</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="py-2 pr-3">{r.id}</td><td>{PEOPLE[r.as_user as User]?.name ?? r.as_user}</td>
                <td className="num text-right">{r.before?.toFixed(2) ?? ""}</td>
                <td className={`num text-right ${r.after != null && r.before != null && r.after > r.before ? "text-accent" : ""}`}>{r.after?.toFixed(2) ?? ""}</td>
                <td className="pl-3 text-muted">{r.leaks.length ? `leaked ${r.leaks.join(", ")}` : r.missing.length ? `missing ${r.missing.join(", ")}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
