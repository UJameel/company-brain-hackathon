"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { Region } from "./chat";
import { apiBase } from "./env";
import type { Grant, User } from "./types";

type Mode = "live" | "recorded" | "checking";
type Session = { user: User; setUser: (u: User) => void; mode: Mode; grants: Grant[]; refresh: () => Promise<void>; granted: (u: User) => boolean; region: Region; setRegion: (r: Region) => void };
const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>("alice");
  const [mode, setMode] = useState<Mode>("checking");
  const [grants, setGrants] = useState<Grant[]>([]);
  const [region, setRegion] = useState<Region>(null);
  const refresh = useCallback(async () => {
    if (!apiBase()) { setMode("recorded"); return; }
    try { const h = await api.health(); setGrants(h.grants ?? []); setMode(h.ok ? "live" : "recorded"); }
    catch { setMode("recorded"); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const value = useMemo<Session>(() => ({
    user, setUser, mode, grants, refresh, region, setRegion,
    granted: (u) => grants.some((g) => g.grantee === u),
  }), [user, mode, grants, refresh, region]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSession outside SessionProvider");
  return s;
}
