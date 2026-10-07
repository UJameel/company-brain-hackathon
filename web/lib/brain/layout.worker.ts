import { forceCenter, forceLink, forceManyBody, forceSimulation, type SimulationNode } from "d3-force-3d";
import type { Graph } from "../types";

self.onmessage = (e: MessageEvent<Graph>) => {
  const nodes: SimulationNode[] = e.data.nodes.map((n) => ({ id: n.id }));
  const links = e.data.edges.map((l) => ({ source: l.source, target: l.target }));
  const sim = forceSimulation(nodes, 3).force("charge", forceManyBody().strength(-8)).force("link", forceLink(links).id((d) => d.id).distance(12)).force("center", forceCenter()).stop();
  for (let i = 0; i < 300; i++) sim.tick();
  postMessage(nodes.map((n) => [n.x ?? 0, n.y ?? 0, n.z ?? 0]));
};
