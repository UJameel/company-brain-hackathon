"use client";
import { neighbours, regionOf, samplePoints, type RegionName } from "@/lib/brain/geometry";
import { useEffect, useRef } from "react";
import type { BrainMode } from "./Brain";

/* Fallback when WebGL is unavailable: an orthographic lateral projection of the same cloud. */
export function Brain2D({ activeRegion, className }: { mode: BrainMode; activeRegion?: RegionName | null; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return; const ctx = c.getContext("2d"); if (!ctx) return;
    const pts = samplePoints(900, 5); const regions = pts.map(regionOf); const edges = neighbours(pts, 2, 0.09);
    const draw = () => {
      const w = c.clientWidth, h = c.clientHeight; c.width = w * 2; c.height = h * 2; ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.clearRect(0, 0, w, h);
      const s = Math.min(w, h) * 0.62; const P = ([x, y]: number[]): [number, number] => [w / 2 + x * s, h / 2 - y * s];
      for (const [a, b] of edges) { const lit = regions[a] === activeRegion || regions[b] === activeRegion; ctx.strokeStyle = lit ? "rgba(200,96,44,.45)" : "rgba(239,230,216,.07)"; ctx.beginPath(); ctx.moveTo(...P(pts[a])); ctx.lineTo(...P(pts[b])); ctx.stroke(); }
      pts.forEach((p, i) => { const lit = regions[i] === activeRegion || activeRegion === "sleep"; const [x, y] = P(p); ctx.fillStyle = lit ? "rgba(232,132,63,.95)" : "rgba(239,230,216,.28)"; ctx.beginPath(); ctx.arc(x, y, lit ? 2.4 : 1.3, 0, 6.28); ctx.fill(); });
    };
    draw(); const ro = new ResizeObserver(draw); ro.observe(c); return () => ro.disconnect();
  }, [activeRegion]);
  return <canvas ref={ref} className={className} aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
}
