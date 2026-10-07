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

export function layoutGraph(graph: Graph): Promise<LaidOut> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./layout.worker.ts", import.meta.url));
    worker.onmessage = (e: MessageEvent<Vec3[]>) => {
      const fitted = fitToVolume(e.data);
      resolve({ ...graph, nodes: graph.nodes.map((n, i) => ({ ...n, x: fitted[i][0], y: fitted[i][1], z: fitted[i][2] })) });
      worker.terminate();
    };
    worker.onerror = (e) => { reject(e); worker.terminate(); };
    worker.postMessage(graph);
  });
}
