import type { Graph, GraphNode } from "../types";
import type { Vec3 } from "./geometry";

export function fitToVolume(positions: Vec3[], padding = 0.9): Vec3[] {
  if (!positions.length) return [];
  const max = [0, 0, 0];
  for (const p of positions) for (let i = 0; i < 3; i++) max[i] = Math.max(max[i], Math.abs(p[i]));
  const box = [0.62, 0.48, 0.5];
  const s = Math.min(...box.map((b, i) => (max[i] ? (b * padding) / max[i] : 1)));
  return positions.map(([x, y, z]) => [x * s, y * s, z * s]);
}

export function sourceTone(tag: string, order: string[]): number {
  let i = order.indexOf(tag);
  if (i < 0) { order.push(tag); i = order.length - 1; }
  return i;
}

export type LaidOut = Graph & { nodes: (GraphNode & { x: number; y: number; z: number })[] };

function attach(graph: Graph, positions: Vec3[]): LaidOut {
  const fitted = fitToVolume(positions);
  return { ...graph, nodes: graph.nodes.map((n, i) => ({ ...n, x: fitted[i]?.[0] ?? 0, y: fitted[i]?.[1] ?? 0, z: fitted[i]?.[2] ?? 0 })) };
}

/** Force layout on the main thread; a few hundred nodes take well under a second. */
async function layoutInline(graph: Graph): Promise<Vec3[]> {
  const { forceCenter, forceLink, forceManyBody, forceSimulation } = await import("d3-force-3d");
  const nodes: import("d3-force-3d").SimulationNode[] = graph.nodes.map((n) => ({ id: n.id }));
  const links = graph.edges.map((l) => ({ source: l.source, target: l.target }));
  const sim = forceSimulation(nodes, 3).force("charge", forceManyBody().strength(-8)).force("link", forceLink(links).id((d) => d.id).distance(12)).force("center", forceCenter()).stop();
  for (let i = 0; i < 300; i++) sim.tick();
  return nodes.map((n) => [n.x ?? 0, n.y ?? 0, n.z ?? 0]);
}

function layoutInWorker(graph: Graph): Promise<Vec3[]> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try { worker = new Worker(new URL("./layout.worker.ts", import.meta.url)); } catch (e) { reject(e); return; }
    const timer = setTimeout(() => { worker.terminate(); reject(new Error("layout worker timed out")); }, 15_000);
    worker.onmessage = (e: MessageEvent<Vec3[]>) => { clearTimeout(timer); resolve(e.data); worker.terminate(); };
    worker.onerror = (e) => { clearTimeout(timer); reject(e); worker.terminate(); };
    worker.postMessage(graph);
  });
}

/** Lay the real graph out inside the brain volume. Tries a Web Worker, falls back to the main thread. */
export async function layoutGraph(graph: Graph): Promise<LaidOut> {
  if (!graph.nodes.length) return attach(graph, []);
  try { return attach(graph, await layoutInWorker(graph)); }
  catch { return attach(graph, await layoutInline(graph)); }
}
