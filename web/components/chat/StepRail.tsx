import type { Turn } from "@/lib/chat";
import { displayText } from "@/lib/names";
import { stepLines } from "@/lib/steps";

export function StepRail({ turn }: { turn: Turn }) {
  return (
    <ol className="mb-3 grid gap-1.5 text-[12.5px]">
      {stepLines(turn).map((l) => (
        <li key={l.god} className="grid grid-cols-[96px_1fr] items-baseline gap-2.5">
          <span className={`font-serif text-sm font-semibold uppercase tracking-[0.08em] transition-colors duration-500 ${l.text && !l.dim ? "text-accent" : "text-fg-2"} ${l.dim ? "opacity-45" : ""}`}>{l.god}</span>
          <span className="text-fg-2">{l.text ? displayText(l.text) : l.pending ? "…" : ""}</span>
        </li>
      ))}
    </ol>
  );
}
