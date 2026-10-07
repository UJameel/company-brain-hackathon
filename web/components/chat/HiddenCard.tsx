"use client";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { HiddenMeta, User } from "@/lib/types";
import { useState } from "react";

export function HiddenCard({ hidden, user, onGranted }: { hidden: Record<string, HiddenMeta>; user: User; onGranted: () => void }) {
  const s = useSession();
  const [busy, setBusy] = useState(false);
  const names = Object.keys(hidden);
  if (!names.length) return null;
  const owner = (hidden[names[0]].owner || "alice") as User;
  const grant = async () => { setBusy(true); try { await api.grant(owner, user); await s.refresh(); onGranted(); } finally { setBusy(false); } };
  return (
    <div className="mt-3 flex items-center justify-between gap-3 border border-dashed border-line-2 px-3 py-2 text-[12.5px]">
      <div className="text-fg-2">
        <b className="font-medium text-fg">{names.length} dataset{names.length > 1 ? "s" : ""} you can&apos;t see</b>
        {names.map((n) => {
          const m = hidden[n]; const what = (m.extra?.length ? m.extra : m.sources) ?? [];
          return <div key={n} className="font-mono text-[11px]">{n} · owner {m.owner}{what.length ? ` · ${what.join(", ")}` : ""}</div>;
        })}
      </div>
      {s.mode === "live" && user !== owner && (
        <button onClick={grant} disabled={busy} className="btn btn-sm btn-primary">{busy ? "Granting" : `Grant as ${owner}`}</button>
      )}
    </div>
  );
}
