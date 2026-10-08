"use client";
import { useSession } from "@/lib/session";

export function QualityStatus() {
  const s = useSession();
  return (
    <div className="border-b border-line px-6 py-5">
      <h2 className="text-3xl">Quality</h2>
      <p className="mt-2 text-sm text-fg-2">Every answer is scored by Themis, an independent judge on a different model from the one that answers. Below: the scenario set before and after the share.</p>
      <p className="mt-2 font-mono text-[11px] text-muted">brain: {s.mode === "live" ? "live" : s.mode === "recorded" ? "recorded replay (API unreachable)" : "checking"}</p>
    </div>
  );
}
