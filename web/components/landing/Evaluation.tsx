import evals from "@/data/evals.json";
import Link from "next/link";
import { Reveal } from "./Reveal";
export function Evaluation() {
  const e = evals as { before: { mean: number } | null; after: { mean: number } | null; isolation: { mean: number } | null };
  const Num = ({ v, l, lit }: { v: number | undefined; l: string; lit?: boolean }) => (
    <div className="bg-bg p-7"><div className={`font-serif text-[96px] leading-[0.9] tracking-[-0.02em] ${lit ? "text-accent" : ""}`}>{v?.toFixed(2) ?? "n/a"}</div><div className="mt-3.5 font-mono text-[13px] text-muted">{l}</div></div>
  );
  return (
    <section id="evaluation" className="border-t border-line py-28">
      <Reveal><h2 className="max-w-[20ch] text-[clamp(34px,4.4vw,60px)]">Scored before and after, by a judge that is not the agent.</h2></Reveal>
      <div className="mt-14 grid gap-px border border-line bg-line md:grid-cols-[1fr_1fr_1.6fr]">
        <Num v={e.isolation?.mean} l="isolation run, 15 scenarios, zero leaks" />
        <Num v={e.before?.mean} l="coverage before the share" />
        <div className="flex flex-col justify-between gap-5 bg-bg p-7">
          <div><div className="font-serif text-[96px] leading-[0.9] text-accent">{e.after?.mean.toFixed(2) ?? "n/a"}</div><div className="mt-3.5 font-mono text-[13px] text-muted">after the grant</div></div>
          <p className="max-w-[46ch] text-[15px] text-fg-2">Themis runs a deterministic fact check and a pinned judge on a different model from the one Athena answers with. Scores are attached to the Respan trace of every run.</p>
          <Link href="/app/evals" className="btn btn-sm self-start">See every scenario</Link>
        </div>
      </div>
    </section>
  );
}
