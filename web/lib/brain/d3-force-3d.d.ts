// d3-force-3d ships no types; this covers the handful of calls the layout worker makes.
declare module "d3-force-3d" {
  export interface SimulationNode { id: string; x?: number; y?: number; z?: number; vx?: number; vy?: number; vz?: number }
  export interface Force { strength(s: number): Force; distance(d: number): Force; id(fn: (d: SimulationNode) => string): Force }
  export interface Simulation { force(name: string, f: Force): Simulation; stop(): Simulation; tick(): Simulation }
  export function forceSimulation(nodes: SimulationNode[], numDimensions?: number): Simulation;
  export function forceManyBody(): Force;
  export function forceLink(links: { source: string; target: string }[]): Force;
  export function forceCenter(): Force;
}
