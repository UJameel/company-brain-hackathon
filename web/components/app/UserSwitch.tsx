"use client";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { USERS, type User } from "@/lib/types";
import { useState } from "react";

const ROLE: Record<User, string> = { alice: "Eng lead", bob: "Contractor" };

export function UserSwitch() {
  const s = useSession();
  const [error, setError] = useState<string | null>(null);
  const revoke = async () => {
    setError(null);
    try {
      if (s.mode === "live") { await api.revoke("alice", "bob"); await s.refresh(); }
      else s.revokeLocal("alice", "bob");
    } catch (e) { setError((e as Error).message); }
  };
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Asking as</span>
      <div className="grid grid-cols-2 gap-1">
        {USERS.map((u) => (
          <button key={u} id={`user-${u}`} onClick={() => s.setUser(u)}
            className={`rounded-[2px] border px-2 py-2 text-left ${s.user === u ? "border-accent text-fg" : "border-line-2 text-fg-2"}`}>
            <div className="font-serif text-lg font-semibold capitalize">{u}</div>
            <div className="font-mono text-[11px] text-muted">{ROLE[u]}</div>
          </button>
        ))}
      </div>
      {s.granted("bob") && (
        <div className="flex items-center justify-between font-mono text-[11px] text-accent">
          <span>alice shared with bob</span>
          <button onClick={revoke} className="text-muted underline-offset-2 hover:underline">Revoke</button>
        </div>
      )}
      {error && <p className="font-mono text-[11px] text-muted">Revoke failed: {error}</p>}
    </div>
  );
}
