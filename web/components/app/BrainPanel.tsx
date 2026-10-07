"use client";
import { useSession } from "@/lib/session";
export function BrainPanel() {
  const { region } = useSession();
  return <div className="flex h-full items-center justify-center font-mono text-[12px] text-muted">{region ?? "idle"}</div>;
}
