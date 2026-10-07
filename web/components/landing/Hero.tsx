"use client";
import type { RegionName } from "@/lib/brain/geometry";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";

// Loaded after hydration so the headline is the LCP element, not the WebGL canvas.
const Brain = dynamic(() => import("@/components/Brain").then((m) => m.Brain), { ssr: false, loading: () => <div className="h-full w-full bg-bg" /> });

const GOD: Record<RegionName, string> = { thalamus: "Hermes", amygdala: "Cerberus", hippocampus: "Mnemosyne", prefrontal: "Athena", motor: "Hephaestus", orbitofrontal: "Themis", sleep: "Morpheus" };

export function Hero() {
  const [r, setR] = useState<RegionName>("thalamus");
  return (
    <header className="grid min-h-[600px] items-center gap-8 py-12 pb-18 lg:grid-cols-[minmax(0,660px)_1fr]">
      <div>
        <p className="insc">A company brain, run by gods</p>
        <h1 className="mt-4 text-[clamp(40px,4.8vw,66px)]">The company brain that knows <em className="italic text-accent">who is asking.</em></h1>
        <p className="mt-6 max-w-[38ch] text-lg leading-snug text-fg-2">Connect anything your company runs on. Pantheon remembers it as you, and answers only what you may know.</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/app" className="btn btn-primary">Open the app</Link>
          <a href="https://github.com/UJameel/company-brain-hackathon" target="_blank" rel="noreferrer" className="btn">View on GitHub</a>
        </div>
      </div>
      <div className="relative order-first aspect-[1.15] w-full max-w-[520px] lg:order-none lg:max-w-none">
        <Brain mode="autoplay" onRegion={setR} className="h-full w-full" />
        <div className="absolute bottom-0 left-0 font-mono text-[11px] text-muted">{r} · {GOD[r]}</div>
      </div>
    </header>
  );
}
