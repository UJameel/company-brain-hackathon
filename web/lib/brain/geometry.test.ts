import { describe, expect, it } from "vitest";
import { inside, neighbours, regionOf, samplePoints } from "./geometry";

describe("geometry", () => {
  it("samples deterministically inside the volume", () => {
    const a = samplePoints(300, 7), b = samplePoints(300, 7);
    expect(a).toEqual(b);
    expect(a).toHaveLength(300);
    expect(a.every(inside)).toBe(true);
    expect(a.every(([, y, z]) => Math.abs(z) >= 0.03 || y <= -0.3)).toBe(true);
  });
  it("assigns the documented regions", () => {
    expect(regionOf([0, 0.02, 0])).toBe("thalamus");
    expect(regionOf([0.12, -0.16, 0.22])).toBe("amygdala");
    expect(regionOf([0.5, 0.1, 0.2])).toBe("prefrontal");
    expect(regionOf([0.3, -0.2, 0.2])).toBe("orbitofrontal");
    expect(regionOf([0.0, 0.42, 0.15])).toBe("motor");
    expect(regionOf([-0.4, 0.1, 0.2])).toBe("cortex");
  });
  it("links each point to at most k neighbours within range", () => {
    const pts = samplePoints(200, 3);
    const edges = neighbours(pts, 2, 0.09);
    expect(edges.length).toBeLessThanOrEqual(400);
    for (const [i, j] of edges) {
      const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1], pts[i][2] - pts[j][2]);
      expect(d).toBeLessThanOrEqual(0.09);
    }
  });
});
