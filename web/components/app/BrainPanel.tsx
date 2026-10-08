"use client";
import { useSession } from "@/lib/session";
import dynamic from "next/dynamic";

const Brain = dynamic(() => import("@/components/Brain").then((m) => m.Brain), { ssr: false, loading: () => <div className="h-full w-full bg-bg" /> });

const GOD: Record<string, string> = { thalamus: "Hermes", amygdala: "Cerberus", hippocampus: "Mnemosyne", prefrontal: "Athena", motor: "Hephaestus", orbitofrontal: "Themis", sleep: "Morpheus" };

export function BrainPanel() {
  const { region } = useSession();
  return (
    <div className="relative h-full">
      <Brain mode="live" activeRegion={region ?? "sleep"} className="h-full w-full" />
      <div className="pointer-events-none absolute left-5 top-5 grid gap-1">
        <span className="insc text-[12px]">{region ? GOD[region] : "Resting"}</span>
        <span className="font-serif text-2xl leading-none text-fg">{region ?? "sleep"}</span>
      </div>
    </div>
  );
}
