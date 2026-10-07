"use client";
import { AGENTS } from "@/data/agents";
import type { RegionName } from "@/lib/brain/geometry";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const Brain = dynamic(() => import("@/components/Brain").then((m) => m.Brain), { ssr: false, loading: () => <div className="h-full w-full bg-bg" /> });

export function Pantheon() {
  const [active, setActive] = useState<RegionName>("thalamus");
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setActive((e.target as HTMLElement).dataset.region as RegionName);
    }, { rootMargin: "-40% 0px -40% 0px", threshold: 0 });
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);
  const a = AGENTS.find((x) => x.region === active)!;
  return (
    <section id="pantheon" className="border-t border-line py-28">
      <p className="insc">The pantheon</p>
      <h2 className="mt-4 max-w-[20ch] text-[clamp(34px,4.4vw,60px)]">Seven agents. Seven regions of one brain.</h2>
      <p className="mt-4 max-w-[56ch] text-[17px] text-fg-2">Each agent does the job its region does in you. Scroll, and the region lights.</p>
      <div className="mt-10 grid gap-12 lg:grid-cols-2">
        <div className="sticky top-16 aspect-[1.1] max-h-[80vh] self-start bg-bg">
          <Brain mode="scroll" activeRegion={active} className="h-full w-full" />
          <div className="pointer-events-none absolute left-0 top-0 grid gap-1"><span className="insc text-[12px]">{a.god}</span><span className="font-serif text-3xl leading-none">{a.regionLabel}</span></div>
        </div>
        <div>
          {AGENTS.map((ag, i) => (
            <div key={ag.region} data-region={ag.region} ref={(el) => { refs.current[i] = el; }}
              className={`flex min-h-[62vh] flex-col justify-center border-t border-line py-10 transition-opacity duration-300 first:border-t-0 ${active === ag.region ? "opacity-100" : "opacity-40"}`}>
              <div className="font-serif text-[clamp(40px,4.5vw,64px)] leading-none"><small className="mb-3 block font-serif text-[13px] font-semibold uppercase tracking-[0.22em] text-accent">{ag.regionLabel}</small>{ag.god}</div>
              <p className="mt-5 max-w-[48ch] text-fg-2"><b className="font-medium text-fg">In you:</b> {ag.inYou}</p>
              <p className="mt-3.5 max-w-[48ch] text-fg"><b className="font-medium">In Pantheon:</b> {ag.inPantheon}</p>
              <p className="mt-4 font-mono text-[11.5px] tracking-[0.04em] text-muted">layer <b className="font-medium text-accent">{ag.layer}</b></p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
