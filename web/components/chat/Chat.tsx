"use client";
import { api } from "@/lib/api";
import { applyEvent, newTurn, type Turn } from "@/lib/chat";
import { findRecorded, replay } from "@/lib/recorded";
import { useSession, useUser } from "@/lib/session";
import type { ChatEvent, User } from "@/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { PEOPLE } from "../app/SignIn";
import { Composer } from "./Composer";
import { TurnView } from "./TurnView";

export function Chat() {
  const s = useSession();
  const me = useUser();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [turns]);

  const update = (id: string, e: ChatEvent) => setTurns((ts) => ts.map((t) => (t.id === id ? applyEvent(t, e) : t)));

  const runOne = useCallback(async (user: User, question: string, drivesBrain = true, afterGrant = false) => {
    const t = newTurn(user, question);
    setTurns((ts) => [...ts, t]);
    const onEvent = (e: ChatEvent) => { update(t.id, e); if (drivesBrain) { const r = applyEvent(t, e).region; if (r) s.setRegion(r); } };
    try {
      if (s.mode === "live") await api.chat(user, question, onEvent);
      else {
        // afterGrant: the re-ask right after a grant, before the session state has re-rendered
        const rec = findRecorded(user, question, afterGrant || s.granted(user));
        if (!rec) onEvent({ name: "error", data: { detail: "No recorded answer for this question. Connect the API for live answers." } });
        else await replay(rec, onEvent);
      }
    } catch (e) { onEvent({ name: "error", data: { detail: (e as Error).message } }); }
  }, [s]);

  const send = async (q: string) => {
    setBusy(true);
    try {
      if (s.compare) { const other: User = me === "alice" ? "bob" : "alice"; await Promise.all([runOne(me, q, true), runOne(other, q, false)]); }
      else await runOne(me, q);
    } finally { setBusy(false); }
  };

  const pairs: Turn[][] = [];
  for (const t of turns) { const last = pairs.at(-1); if (s.compare && last && last.length === 1 && last[0].question === t.question && last[0].user !== t.user) last.push(t); else pairs.push([t]); }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {turns.length === 0 && (
          <div className="mx-auto max-w-md pt-24 text-center text-fg-2">
            <p className="font-serif text-3xl text-fg">Hello, {PEOPLE[me].name}</p>
            <p className="mt-3 text-sm">Ask about anything your connected accounts can see. When the brain suggests a follow-up, answer in plain words: yes, no, or what to change.</p>
          </div>
        )}
        {pairs.map((pair) => (
          <div key={pair[0].id} className={pair.length === 2 ? "grid gap-4 lg:grid-cols-2" : ""}>
            {pair.map((t) => <TurnView key={t.id} turn={t} onGranted={() => void runOne(t.user, t.question, t.user === me, true)} />)}
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <Composer busy={busy} onSend={send} />
    </div>
  );
}
