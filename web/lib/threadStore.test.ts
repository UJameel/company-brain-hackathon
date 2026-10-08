import { beforeEach, describe, expect, it } from "vitest";
import { applyEvent, newTurn } from "./chat";
import { loadThread, saveThread } from "./threadStore";
import type { Result } from "./types";

const done: Result = { user: "bob", question: "Q", answer: "A", sources: [], hidden: [], action: null, usage: [], feed: [], latency_s: 1, themis: null, cost_usd: 0 };

describe("threadStore", () => {
  beforeEach(() => window.sessionStorage.clear());
  it("round-trips finished turns per user and drops unfinished ones", () => {
    const finished = applyEvent(newTurn("bob", "Q"), { name: "done", data: done });
    const pending = newTurn("bob", "Q2");
    saveThread("bob", [finished, pending]);
    const back = loadThread("bob");
    expect(back.map((t) => t.question)).toEqual(["Q"]);
    expect(back[0].answer).toBe("A");
    expect(loadThread("alice")).toEqual([]);
  });
  it("survives storage being unavailable", () => {
    const orig = window.sessionStorage.setItem;
    window.sessionStorage.setItem = () => { throw new Error("blocked"); };
    expect(() => saveThread("bob", [])).not.toThrow();
    window.sessionStorage.setItem = orig;
  });
});
