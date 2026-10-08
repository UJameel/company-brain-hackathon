"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { Region } from "./chat";
import { apiBase } from "./env";
import type { Grant, User } from "./types";

type Mode = "live" | "recorded" | "checking";
type Session = {
  user: User | null; signIn: (u: User) => void; signOut: () => void;
  mode: Mode; grants: Grant[]; refresh: () => Promise<void>;
  granted: (u: User) => boolean; grantLocal: (owner: User, to: User) => void; revokeLocal: (owner: User, to: User) => void;
  region: Region; setRegion: (r: Region) => void;
  compare: boolean; setCompare: (v: boolean) => void;  // developer toggle, lives under the user menu
};
const Ctx = createContext<Session | null>(null);
const KEY = "pantheon.user";  // sessionStorage: one sign-in per tab, so two windows can be two people

function readStoredUser(): User | null {
  try { const v = window.sessionStorage.getItem(KEY); return v === "alice" || v === "bob" ? v : null; } catch { return null; }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<Mode>("checking");
  const [grants, setGrants] = useState<Grant[]>([]);
  const [local, setLocal] = useState<Grant[]>([]);  // recorded mode: grants the viewer made on this page only
  const [region, setRegion] = useState<Region>(null);
  const [compare, setCompare] = useState(false);
  useEffect(() => { setUser(readStoredUser()); }, []);
  const signIn = useCallback((u: User) => { setUser(u); try { window.sessionStorage.setItem(KEY, u); } catch { /* storage blocked */ } }, []);
  const signOut = useCallback(() => { setUser(null); setRegion(null); try { window.sessionStorage.removeItem(KEY); } catch { /* storage blocked */ } }, []);
  const refresh = useCallback(async () => {
    if (!apiBase()) { setMode("recorded"); return; }
    try { const h = await api.health(); setGrants(h.grants ?? []); setMode(h.ok ? "live" : "recorded"); }
    catch { setMode("recorded"); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const value = useMemo<Session>(() => ({
    user, signIn, signOut, mode, grants, refresh, region, setRegion, compare, setCompare,
    granted: (u) => grants.some((g) => g.grantee === u) || local.some((g) => g.grantee === u),
    grantLocal: (owner, to) => setLocal((xs) => (xs.some((g) => g.owner === owner && g.grantee === to) ? xs : [...xs, { owner, grantee: to, dataset: `${owner}-brain`, permission: "read" }])),
    revokeLocal: (owner, to) => setLocal((xs) => xs.filter((g) => !(g.owner === owner && g.grantee === to))),
  }), [user, signIn, signOut, mode, grants, local, refresh, region, compare]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSession outside SessionProvider");
  return s;
}

/** Inside the signed-in app shell the user is always set; this narrows the type. */
export function useUser(): User {
  const { user } = useSession();
  if (!user) throw new Error("useUser called while signed out");
  return user;
}
