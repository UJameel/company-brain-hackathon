// Captures the real graph and connections for both users, so the hosted app can show them
// without the API. Usage: API=http://localhost:8080 node scripts/record-extras.mjs
import { writeFileSync } from "node:fs";

const API = process.env.API ?? "http://localhost:8080";
const get = (p) => fetch(`${API}${p}`).then((r) => { if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json(); });

const graph = {}, connections = {};
for (const user of ["alice", "bob"]) {
  graph[user] = await get(`/graph?user=${user}&max_nodes=600`);
  connections[user] = await get(`/connections?user=${user}`).catch(() => []);
  console.log(user, "nodes", graph[user].nodes.length, "edges", graph[user].edges.length, "connections", connections[user].length);
}
writeFileSync(new URL("../data/graph.json", import.meta.url), JSON.stringify(graph));
writeFileSync(new URL("../data/connections.json", import.meta.url), JSON.stringify(connections, null, 2));
