import { describe, expect, it } from "vitest";
import { fitToVolume, sourceTone } from "./layout";

describe("layout", () => {
  it("fits positions into the brain volume", () => {
    const out = fitToVolume([[0, 0, 0], [100, 50, -20], [-100, -50, 20]], 1);
    for (const [x, y, z] of out) { expect(Math.abs(x)).toBeLessThanOrEqual(0.62); expect(Math.abs(y)).toBeLessThanOrEqual(0.48); expect(Math.abs(z)).toBeLessThanOrEqual(0.5); }
    expect(out[0]).toEqual([0, 0, 0]);
  });
  it("assigns stable tones by first appearance", () => {
    const order: string[] = [];
    expect(sourceTone("source:slack", order)).toBe(0);
    expect(sourceTone("source:gmail", order)).toBe(1);
    expect(sourceTone("source:slack", order)).toBe(0);
  });
});
