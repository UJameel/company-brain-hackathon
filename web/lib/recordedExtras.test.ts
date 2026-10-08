import { describe, expect, it } from "vitest";
import { recordedGraphFor } from "./recordedExtras";
import type { Graph } from "./types";

const alice: Graph = { nodes: [{ id: "a1", label: "A", type: "Entity", node_set: ["source:github"], dataset: "alice-brain" }, { id: "shared", label: "S", type: "Entity", node_set: [], dataset: "alice-brain" }], edges: [{ source: "a1", target: "shared", label: "r" }] };
const bob: Graph = { nodes: [{ id: "b1", label: "B", type: "Entity", node_set: ["source:slack"], dataset: "bob-brain" }, { id: "shared", label: "S", type: "Entity", node_set: [], dataset: "bob-brain" }], edges: [{ source: "b1", target: "shared", label: "r" }] };

describe("recordedGraphFor", () => {
  it("returns the user's own graph before a grant", () => {
    const g = recordedGraphFor("bob", false, { alice, bob });
    expect(g.nodes.map((n) => n.id)).toEqual(["b1", "shared"]);
  });
  it("merges the owner's graph after a grant, without duplicate nodes", () => {
    const g = recordedGraphFor("bob", true, { alice, bob });
    expect(g.nodes.map((n) => n.id).sort()).toEqual(["a1", "b1", "shared"]);
    expect(g.edges).toHaveLength(2);
  });
  it("alice never gains bob's graph", () => {
    expect(recordedGraphFor("alice", true, { alice, bob }).nodes.map((n) => n.id)).toEqual(["a1", "shared"]);
  });
});
