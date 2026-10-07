import { describe, expect, it } from "vitest";
import { applyEvent, newTurn } from "./chat";
import type { Result } from "./types";

const done: Result = { user: "bob", question: "Q", answer: "A", sources: ["source:slack"], hidden: ["alice-brain"], action: null, usage: [], feed: [], latency_s: 1, themis: null, cost_usd: 0 };

describe("applyEvent", () => {
  it("accumulates tokens and lights regions in order", () => {
    let t = newTurn("bob", "Q");
    t = applyEvent(t, { name: "hermes", data: { intent: "question", action_tool: null, model: "gpt-4o-mini" } });
    expect(t.region).toBe("thalamus");
    t = applyEvent(t, { name: "cerberus", data: { readable: ["bob-brain"], hidden: { "alice-brain": { owner: "alice", extra: ["channel:leadership"] } } } });
    expect(t.region).toBe("amygdala");
    t = applyEvent(t, { name: "athena.recall", data: { passages: 3, sources: ["source:slack"], model: "claude-sonnet-4-5" } });
    expect(t.region).toBe("hippocampus");
    t = applyEvent(t, { name: "athena.token", data: { text: "The " } });
    t = applyEvent(t, { name: "athena.token", data: { text: "end." } });
    expect(t.answer).toBe("The end.");
    expect(t.region).toBe("prefrontal");
    t = applyEvent(t, { name: "done", data: done });
    expect(t.done).toBe(true);
    expect(t.result?.hidden).toEqual(["alice-brain"]);
    expect(t.steps.cerberus?.hidden["alice-brain"].owner).toBe("alice");
  });
  it("records an error and ends the turn", () => {
    const t = applyEvent(newTurn("alice", "Q"), { name: "error", data: { detail: "gateway closed" } });
    expect(t.error).toBe("gateway closed");
    expect(t.done).toBe(true);
  });
  it("keeps proposals from the stream, or takes them from done", () => {
    const p = { id: "a1", user: "bob" as const, as_user: "bob@northwind.dev", tool: "request_access", input: {}, rationale: "r", origin: "suggested" as const, status: "proposed", parent: null, created_at: "t" };
    const streamed = applyEvent(newTurn("bob", "Q"), { name: "hephaestus.proposed", data: { proposals: [p] } });
    expect(streamed.region).toBe("motor");
    expect(streamed.steps.proposals).toEqual([p]);
    const viaDone = applyEvent(newTurn("bob", "Q"), { name: "done", data: { ...done, suggested_actions: [p] } });
    expect(viaDone.steps.proposals).toEqual([p]);
  });
  it("does not mutate the previous turn", () => {
    const a = newTurn("alice", "Q");
    const b = applyEvent(a, { name: "athena.token", data: { text: "x" } });
    expect(a.answer).toBe("");
    expect(b.answer).toBe("x");
  });
});
