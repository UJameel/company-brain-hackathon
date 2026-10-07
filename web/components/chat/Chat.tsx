"use client";
import { api } from "@/lib/api";
import { applyEvent, newTurn, type Turn } from "@/lib/chat";
import { findRecorded, replay } from "@/lib/recorded";
import { useSession } from "@/lib/session";
import type { ChatEvent, User } from "@/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { Composer } from "./Composer";
import { TurnView } from "./TurnView";

export function Chat() {
  const s = useSession();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [compare, setCompare] = useState(false);
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [turns]);

  const update = (id: string, e: ChatEvent) => setTurns((ts) => ts.map((t) => (t.id === id ? applyEvent(t, e) : t)));

  const runOne = useCallback(async (user: User, question: string) => {
    const t = newTurn(user, question);
    setTurns((ts) => [...ts, t]);
    const onEvent = (e: ChatEvent) => { update(t.id, e); const r = applyEvent(t, e).region; if (r) s.setRegion(r); };
    try {
      if (s.mode === "live") await api.chat(user, question, onEvent);
      else {
        const rec = findRecorded(user, question, s.granted(user));
        if (!rec) onEvent({ name: "error", data: { detail: "No recorded answer for this question. Connect the API for live answers." } });
        else await replay(rec, onEvent);
      }
    } catch (e) { onEvent({ name: "error", data: { detail: (e as Error).message } }); }
  }, [s]);

  const send = async (q: string) => {
    setBusy(true);
    try { if (compare) await Promise.all([runOne("alice", q), runOne("bob", q)]); else await runOne(s.user, q); }
    finally { setBusy(false); }  // the last region stays lit until the next question, so the audience can read it
  };

  const pairs: Turn[][] = [];
  for (const t of turns) { const last = pairs.at(-1); if (compare && last && last.length === 1 && last[0].question === t.question && last[0].user !== t.user) last.push(t); else pairs.push([t]); }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {turns.length === 0 && (
          <div className="mx-auto max-w-md pt-24 text-center text-fg-2">
            <p className="font-serif text-3xl text-fg">Ask the brain</p>
            <p className="mt-3 text-sm">Pick a question below or type your own. Switch who is asking in the rail; the answer changes with the person.</p>
          </div>
        )}
        {pairs.map((pair) => (
          <div key={pair[0].id} className={pair.length === 2 ? "grid gap-4 lg:grid-cols-2" : ""}>
            {pair.map((t) => <TurnView key={t.id} turn={t} onGranted={() => void runOne(t.user, t.question)} />)}
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <Composer busy={busy} compare={compare} onCompare={setCompare} onSend={send} />
    </div>
  );
}
