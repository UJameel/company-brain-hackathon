import connectionsData from "@/data/connections.json";
import graphData from "@/data/graph.json";
import type { Connection, Graph, User } from "./types";

const GRAPHS = graphData as Record<User, Graph>;
const CONNECTIONS = connectionsData as Record<User, Connection[]>;

/** The graph a user can see in recorded mode: their own brain, plus the owner's after a grant. */
export function recordedGraphFor(user: User, granted: boolean, graphs: Record<User, Graph> = GRAPHS): Graph {
  const own = graphs[user] ?? { nodes: [], edges: [] };
  if (!granted || user !== "bob") return own;
  const shared = graphs.alice ?? { nodes: [], edges: [] };
  const seen = new Set(own.nodes.map((n) => n.id));
  const nodes = [...own.nodes, ...shared.nodes.filter((n) => !seen.has(n.id))];
  const key = (e: Graph["edges"][number]) => `${e.source}>${e.target}>${e.label}`;
  const seenEdges = new Set(own.edges.map(key));
  const edges = [...own.edges, ...shared.edges.filter((e) => !seenEdges.has(key(e)))];
  return { nodes, edges };
}

export function recordedConnectionsFor(user: User): Connection[] {
  return CONNECTIONS[user] ?? [];
}
