import { describe, expect, it } from "vitest";
import { pairRows } from "./evals";
import type { Results } from "./types";

const row = (id: string, final: number): Results["rows"][number] => ({ id, as_user: "bob", question: "q", answer: "a", sources: [], hidden: [], score: { final, missing: [], leaks: [], ungrounded: [] }, latency_s: 1 });

describe("pairRows", () => {
  it("joins by id and tolerates a missing side", () => {
    const before: Results = { label: "b", n: 2, mean: 0.5, models: {}, rows: [row("x", 0.4), row("y", 0.6)] };
    const after: Results = { label: "a", n: 1, mean: 1, models: {}, rows: [row("x", 1)] };
    const rows = pairRows(before, after);
    expect(rows.map((r) => [r.id, r.before, r.after])).toEqual([["x", 0.4, 1], ["y", 0.6, null]]);
    expect(pairRows(null, after)[0]).toMatchObject({ id: "x", before: null, after: 1 });
  });
});
