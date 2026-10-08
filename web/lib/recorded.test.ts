import { describe, expect, it } from "vitest";
import { findRecorded, recordedKey, replay } from "./recorded";
import type { ChatEvent, Result } from "./types";

const r: Result = { user: "bob", question: "What will the Pro plan cost after the Atlas launch?", answer: "Pro is $49.", sources: ["source:slack"], hidden: ["alice-brain"], action: null, usage: [], feed: [], latency_s: 1, themis: null, cost_usd: 0 };

describe("recorded", () => {
  it("keys are case and whitespace insensitive", () => {
    expect(recordedKey("bob", "  what WILL the pro plan cost after the atlas launch?", false)).toBe("bob|what will the pro plan cost after the atlas launch?|before");
  });
  it("returns null for an unknown question", () => {
    expect(findRecorded("bob", "Who is on call?", false)).toBeNull();
  });
  it("replays a result as the ordered event stream", async () => {
    const names: string[] = [];
    let answer = "";
    await replay(r, (e: ChatEvent) => { names.push(e.name); if (e.name === "athena.token") answer += e.data.text; }, { delayMs: 0 });
    expect(names[0]).toBe("hermes"); expect(names[1]).toBe("cerberus"); expect(names[2]).toBe("athena.recall");
    expect(names.at(-1)).toBe("done"); expect(names).not.toContain("hephaestus");
    expect(answer).toBe("Pro is $49.");
  });
});
