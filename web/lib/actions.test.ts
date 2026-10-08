import { describe, expect, it } from "vitest";
import { proposalFromRequest, resultUrl } from "./actions";

describe("resultUrl", () => {
  it("finds the created item's link anywhere in the connector result", () => {
    expect(resultUrl({ status: "executed", result: { data: { number: 7, html_url: "https://github.com/x/y/issues/7" } } })).toBe("https://github.com/x/y/issues/7");
    expect(resultUrl({ status: "executed", result: { ok: true } })).toBeNull();
    // Scalekit's GitHub connector returns the issue as a JSON string
    expect(resultUrl({ status: "executed", result: '{"number": 6, "reactions": {"url": "https://api.github.com/x"}, "html_url": "https://github.com/UJameel/northwind-atlas/issues/6"}' })).toBe("https://github.com/UJameel/northwind-atlas/issues/6");
  });
});

describe("proposalFromRequest", () => {
  it("turns a dry-run explicit request into a proposal the person can approve, decline or revise", () => {
    const p = proposalFromRequest("alice", { id: "r1", tool: "github_issue_create", status: "dry-run", as_user: "alice@northwind.dev", input: { title: "Add backoff", body: "…" } });
    expect(p).toMatchObject({ id: "r1", user: "alice", as_user: "alice@northwind.dev", tool: "github_issue_create", origin: "requested", status: "proposed", input: { title: "Add backoff" } });
  });
  it("returns null for executed or refused actions and for actions without an id", () => {
    expect(proposalFromRequest("alice", { id: "r2", tool: "slack_send_message", status: "executed" })).toBeNull();
    expect(proposalFromRequest("alice", { tool: "slack_send_message", status: "dry-run" })).toBeNull();
  });
});
