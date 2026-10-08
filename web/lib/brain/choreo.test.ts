import { describe, expect, it } from "vitest";
import { CAMERA, orbitToPosition, spring } from "./choreo";

describe("choreo", () => {
  it("has a target for every region", () => {
    expect(Object.keys(CAMERA).sort()).toEqual(["amygdala", "hippocampus", "motor", "orbitofrontal", "prefrontal", "sleep", "thalamus"]);
    expect(CAMERA.prefrontal).toEqual({ az: 15, el: 8, dist: 2.1 });
  });
  it("spring converges without overshooting much", () => {
    let v = 0, x = 0;
    for (let i = 0; i < 240; i++) [x, v] = spring(x, 1, v, 1 / 60);
    expect(Math.abs(x - 1)).toBeLessThan(0.01);
  });
  it("orbit maps az/el/dist to a position on the sphere", () => {
    const [x, y, z] = orbitToPosition(0, 0, 2);
    expect([x, y, z].map((n) => +n.toFixed(3))).toEqual([2, 0, 0]);
    const [, y2] = orbitToPosition(0, 90, 2);
    expect(+y2.toFixed(3)).toBe(2);
  });
});
