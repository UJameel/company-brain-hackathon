"use client";
import { api } from "@/lib/api";
import { useSession, useUser } from "@/lib/session";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar, PEOPLE } from "./SignIn";

export function UserMenu() {
  const s = useSession();
  const user = useUser();
  const [open, setOpen] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc); return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const revoke = async () => {
    setError(null);
    try { if (s.mode === "live") { await api.revoke("alice", "bob"); await s.refresh(); } else s.revokeLocal("alice", "bob"); }
    catch (e) { setError((e as Error).message); }
  };
  const reset = async () => {
    setRestarting(true);
    try { await api.reset(); } catch { /* the process exits before answering */ }
    const until = Date.now() + 30_000;
    while (Date.now() < until) { await new Promise((r) => setTimeout(r, 1500)); try { await api.health(); break; } catch { /* retry */ } }
    await s.refresh(); setRestarting(false);
  };
  const p = PEOPLE[user];
  return (
    <div ref={ref} className="relative">
      <button id="user-menu" onClick={() => setOpen(!open)} className="flex items-center gap-3 border border-transparent px-2 py-1 hover:border-line-2" aria-haspopup="menu" aria-expanded={open}>
        <Avatar user={user} size={30} />
        <span className="text-left leading-tight">
          <span className="block font-serif text-base font-semibold">{p.name}</span>
          <span className="block font-mono text-[10.5px] text-muted">{p.sources.join(" · ")}</span>
        </span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-2 w-64 border border-line bg-bg-2 p-2 text-sm shadow-[0_12px_40px_rgba(0,0,0,.5)]">
          <div className="px-2 py-1.5 font-mono text-[11px] text-muted">{p.role}</div>
          <Link href="/app/actions" role="menuitem" onClick={() => setOpen(false)} className="block px-2 py-1.5 hover:bg-bg-3">Actions history</Link>
          <Link href="/app/quality" role="menuitem" onClick={() => setOpen(false)} className="block px-2 py-1.5 hover:bg-bg-3">Quality</Link>
          {s.granted("bob") && <button role="menuitem" onClick={revoke} className="block w-full px-2 py-1.5 text-left hover:bg-bg-3">Revoke Alice&apos;s share with Bob</button>}
          {s.mode === "live" && <button role="menuitem" onClick={reset} disabled={restarting} className="block w-full px-2 py-1.5 text-left hover:bg-bg-3">{restarting ? "Restarting the brain" : "Reset the demo"}</button>}
          <label className="flex items-center gap-2 px-2 py-1.5 font-mono text-[11px] text-muted"><input id="compare" type="checkbox" checked={s.compare} onChange={(e) => s.setCompare(e.target.checked)} />Developer: compare both users</label>
          <div className="my-1 border-t border-line" />
          <button id="sign-out" role="menuitem" onClick={() => { setOpen(false); s.signOut(); }} className="block w-full px-2 py-1.5 text-left hover:bg-bg-3">Sign out</button>
          {error && <p className="px-2 py-1 font-mono text-[11px] text-muted">{error}</p>}
        </div>
      )}
    </div>
  );
}
