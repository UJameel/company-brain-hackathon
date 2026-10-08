import { describe, expect, it } from "vitest";
import { applyEvent, newTurn } from "./chat";
import { sourceName, stepLines } from "./steps";

describe("sourceName", () => {
  it("turns provenance tags into product names", () => {
    expect(sourceName("source:github")).toBe("GitHub");
    expect(sourceName("source:slack")).toBe("Slack");
    expect(sourceName("source:notion")).toBe("Notion");
    expect(sourceName("source:pantheon")).toBe("past decisions");
    expect(sourceName("source:linear")).toBe("Linear");
  });
});

describe("stepLines", () => {
  it("describes a question turn in plain language", () => {
    let t = newTurn("alice", "Q");
    t = applyEvent(t, { name: "hermes", data: { intent: "question", action_tool: null, model: "respan/gpt-4o-mini" } });
    t = applyEvent(t, { name: "cerberus", data: { readable: ["alice-brain"], hidden: {} } });
    t = applyEvent(t, { name: "athena.recall", data: { passages: 9, sources: ["source:github", "source:slack", "source:notion"], model: "respan/claude-sonnet-4-5" } });
    t = applyEvent(t, { name: "hephaestus.proposed", data: { proposals: [{ id: "a1", user: "alice", as_user: "", tool: "slack_send_message", input: {}, rationale: "", origin: "suggested", status: "proposed", parent: null, created_at: "" }] } });
    const lines = stepLines(t);
    expect(lines.map((l) => l.text)).toEqual([
      "Understood as a question",
      "Alice may read alice-brain; nothing hidden",
      "Found 9 passages across GitHub, Slack and Notion",
      "Suggests 1 follow-up",
    ]);
    expect(lines.every((l) => !/respan|gpt|claude/i.test(l.text))).toBe(true);
  });
  it("names what is hidden and a dry-run action", () => {
    let t = newTurn("bob", "Draft a message");
    t = applyEvent(t, { name: "hermes", data: { intent: "action", action_tool: "slack_send_message", model: "m" } });
    t = applyEvent(t, { name: "cerberus", data: { readable: ["bob-brain"], hidden: { "alice-brain": { owner: "alice" } } } });
    t = applyEvent(t, { name: "athena.recall", data: { passages: 0, sources: [], model: "m" } });
    t = applyEvent(t, { name: "hephaestus", data: { tool: "slack_send_message", status: "dry-run", as_user: "bob@northwind.dev" } });
    expect(stepLines(t).map((l) => l.text)).toEqual([
      "Understood as a request to send a Slack message",
      "Bob may read bob-brain; hidden: alice-brain (owner alice)",
      "Found nothing readable",
      "Drafted a Slack message as bob@northwind.dev (dry run)",
    ]);
  });
  it("describes a decision turn", () => {
    let t = newTurn("bob", "yes");
    t = applyEvent(t, { name: "hermes", data: { intent: "decision", action_tool: null, model: "m", decision: "approve" } });
    t = applyEvent(t, { name: "hephaestus.decided", data: { decision: { decision: "approve", action: { id: "a1", user: "bob", as_user: "bob@northwind.dev", tool: "github_issue_create", input: {}, rationale: "", origin: "suggested", status: "executed", parent: null, created_at: "" } } } });
    expect(stepLines(t).map((l) => l.text)).toEqual(["Understood as a decision: approve", "Approved: opened a GitHub issue as bob@northwind.dev"]);
  });
  it("shows a waiting marker while a step is pending", () => {
    const t = applyEvent(newTurn("alice", "Q"), { name: "hermes", data: { intent: "question", action_tool: null, model: "m" } });
    const lines = stepLines(t);
    expect(lines[1]).toMatchObject({ god: "Cerberus", pending: true });
  });
});
