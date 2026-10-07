import type { Turn } from "@/lib/chat";

const STEPS = [
  { key: "hermes", god: "Hermes", text: (t: Turn) => t.steps.hermes && `routed: ${t.steps.hermes.intent} via ${t.steps.hermes.model}` },
  { key: "cerberus", god: "Cerberus", text: (t: Turn) => t.steps.cerberus && `may read ${t.steps.cerberus.readable.join(", ")}; hidden ${Object.keys(t.steps.cerberus.hidden).join(", ") || "none"}` },
  { key: "athena", god: "Athena", text: (t: Turn) => t.steps.recall && `${t.steps.recall.passages} passages from ${t.steps.recall.sources.join(", ") || "nothing readable"} via ${t.steps.recall.model}` },
  { key: "hephaestus", god: "Hephaestus", text: (t: Turn) => t.steps.hephaestus ? `${t.steps.hephaestus.tool} ${t.steps.hephaestus.status} as ${t.steps.hephaestus.as_user ?? t.user}` : t.steps.proposals?.length ? `proposed ${t.steps.proposals.length} follow-up${t.steps.proposals.length > 1 ? "s" : ""}` : (t.done && t.steps.hermes?.intent !== "action" ? "not needed for a question" : undefined) },
] as const;

export function StepRail({ turn }: { turn: Turn }) {
  return (
    <ol className="mb-3 grid gap-1.5 font-mono text-[11.5px]">
      {STEPS.map(({ key, god, text }) => {
        const detail = text(turn);
        const lit = Boolean(detail) && !(key === "hephaestus" && detail?.startsWith("not needed"));
        return (
          <li key={key} className="grid grid-cols-[96px_1fr] items-baseline gap-2.5">
            <span className={`font-serif text-sm font-semibold uppercase tracking-[0.08em] transition-colors duration-500 ${lit ? "text-accent" : "text-fg-2"} ${detail?.startsWith("not needed") ? "opacity-45" : ""}`}>{god}</span>
            <span className="text-muted">{detail ?? (turn.done ? "" : "…")}</span>
          </li>
        );
      })}
    </ol>
  );
}
