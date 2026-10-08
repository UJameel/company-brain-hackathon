"use client";
import { api } from "@/lib/api";
import { useSession, useUser } from "@/lib/session";
import type { Connection } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";

export function ConnectionsView() {
  const s = useSession(); const me = useUser();
  const [rows, setRows] = useState<Connection[] | null>(null);
  const [form, setForm] = useState({ channels: "#general,#engineering", github_repo: "UJameel/northwind-atlas", notion_query: "Atlas Launch Plan", all: true });
  const [log, setLog] = useState<string | null>(null);
  const load = useCallback(() => { if (s.mode === "live") api.connections(me).then(setRows).catch((e) => setLog((e as Error).message)); }, [s.mode, me]);
  useEffect(load, [load]);
  const sync = async () => {
    setLog("Mnemosyne is pulling as " + me + ". This takes a while; chat for this user waits.");
    try {
      const r = await api.sync({ user: me, channels: form.channels.split(",").map((c) => c.trim()).filter(Boolean), github_repo: form.github_repo || null, notion_query: form.notion_query || null, all_sources: form.all });
      setLog(`Remembered ${String(r.documents ?? "?")} documents into ${String(r.dataset ?? "")} from ${(r.sources as string[] | undefined)?.join(", ") ?? "recorded data"}.`);
    } catch (e) { setLog("Sync failed: " + (e as Error).message); }
    load();
  };
  if (s.mode !== "live") return <div className="p-6 text-fg-2">Connections need the live API and a Scalekit workspace.</div>;
  return (
    <div className="max-w-3xl space-y-8 p-6">
      <section>
        <h2 className="text-3xl">Your connections</h2>
        <p className="mt-2 text-sm text-fg-2">Each person links their own accounts, any system your company runs on. Pantheon only ever reads what these accounts can read.</p>
        <ul className="mt-5 divide-y divide-line border-y border-line font-mono text-[12.5px]">
          {(rows ?? []).map((c) => (
            <li key={c.connection} className="grid grid-cols-[1fr_auto_auto_88px] items-center gap-3 py-3">
              <span>{c.connection}{c.provider && c.provider !== c.connection ? <span className="text-muted"> · {c.provider}</span> : null}</span>
              <span className="text-muted">{c.adapter === "known" ? "adapter" : "generic"}</span>
              <span className={c.status === "ACTIVE" ? "text-accent" : "text-muted"}>{c.status ?? "unknown"}</span>
              {c.link ? <a className="btn btn-sm" href={c.link} target="_blank" rel="noreferrer">Connect</a> : <span />}
            </li>
          ))}
          {rows && rows.length === 0 && <li className="py-3 text-muted">{me} has connected nothing yet. The brain only holds what this person can pull.</li>}
          {!rows && <li className="py-3 text-muted">Asking Scalekit</li>}
        </ul>
      </section>
      <section>
        <h2 className="text-3xl">Sync now</h2>
        <div className="mt-4 grid gap-3 text-sm">
          {([["channels", "Slack channels"], ["github_repo", "GitHub repo"], ["notion_query", "Notion search"]] as const).map(([k, label]) => (
            <label key={k} className="grid gap-1"><span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{label}</span>
              <input id={`sync-${k}`} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="border border-line-2 bg-bg px-3 py-2 text-fg focus:border-accent focus:outline-none" /></label>
          ))}
          <label className="flex items-center gap-2 font-mono text-[11px] text-fg-2"><input id="sync-all" type="checkbox" checked={form.all} onChange={(e) => setForm({ ...form, all: e.target.checked })} />Every connector this user has authorised</label>
          <button onClick={sync} className="btn btn-primary self-start">Pull as {me}</button>
          {log && <p className="font-mono text-[12px] text-fg-2">{log}</p>}
        </div>
      </section>
    </div>
  );
}
