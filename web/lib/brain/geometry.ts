export type Vec3 = [number, number, number];
export type RegionName = "thalamus" | "amygdala" | "hippocampus" | "prefrontal" | "motor" | "orbitofrontal" | "sleep";

function rng(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

function gyri(x: number, y: number, z: number): number {
  return 0.04 * (Math.sin(9 * x + 2 * y) * Math.cos(7 * y - 3 * z) + 0.6 * Math.sin(11 * z + 4 * x)) / 1.6;
}

export function inside([x, y, z]: Vec3): boolean {
  if (Math.abs(z) < 0.03 && y > -0.3) return false;                         // longitudinal fissure
  for (const side of [-0.1, 0.1]) {
    const dz = z - side;
    const r = (x / 0.62) ** 2 + (y / 0.48) ** 2 + (dz / 0.4) ** 2;
    if (r <= 1 + gyri(x, y, z) * 2) return true;                            // hemisphere with gyri displacement
  }
  if (((x + 0.42) / 0.22) ** 2 + ((y + 0.34) / 0.14) ** 2 + (z / 0.26) ** 2 <= 1) return true; // cerebellum
  const t = (y + 0.4) / -0.38;                                               // brain stem, y from -0.40 down to -0.78
  if (t >= 0 && t <= 1) { const cx = -0.28 - 0.02 * t; if (Math.hypot(x - cx, z) <= 0.07) return true; }
  return false;
}

export function regionOf([x, y, z]: Vec3): RegionName | "cortex" {
  if (Math.hypot(x, y - 0.02, z) <= 0.1) return "thalamus";
  for (const s of [-0.22, 0.22]) if (Math.hypot(x - 0.12, y + 0.16, z - s) <= 0.06) return "amygdala";
  for (const s of [-0.24, 0.24]) {                                           // hippocampus: a tube from (.08,-.18,s) to (-.18,-.14,s+.02)
    const ax = 0.08, ay = -0.18, bx = -0.18, by = -0.14, bz = s + 0.02;
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
    const px = ax + t * (bx - ax), py = ay + t * (by - ay), pz = s + t * (bz - s);
    if (Math.hypot(x - px, y - py, z - pz) <= 0.05) return "hippocampus";
  }
  if (x > 0.36 && y > -0.1) return "prefrontal";
  if (x > 0.26 && y > -0.34 && y <= -0.1) return "orbitofrontal";
  if (x > -0.08 && x < 0.12 && y > 0.36) return "motor";
  return "cortex";
}

export function samplePoints(n: number, seed: number): Vec3[] {
  const r = rng(seed); const out: Vec3[] = [];
  while (out.length < n) {
    const p: Vec3 = [r() * 1.5 - 0.8, r() * 1.4 - 0.85, r() * 1.1 - 0.55];
    if (inside(p)) out.push(p);
  }
  return out;
}

export function neighbours(points: Vec3[], k = 2, maxDist = 0.09): [number, number][] {
  const cell = maxDist; const grid = new Map<string, number[]>();
  const key = (p: Vec3) => `${Math.floor(p[0] / cell)},${Math.floor(p[1] / cell)},${Math.floor(p[2] / cell)}`;
  points.forEach((p, i) => { const k2 = key(p); (grid.get(k2) ?? grid.set(k2, []).get(k2)!).push(i); });
  const edges: [number, number][] = []; const seen = new Set<string>();
  points.forEach((p, i) => {
    const cand: [number, number][] = [];
    const [gx, gy, gz] = [Math.floor(p[0] / cell), Math.floor(p[1] / cell), Math.floor(p[2] / cell)];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++)
      for (const j of grid.get(`${gx + dx},${gy + dy},${gz + dz}`) ?? []) {
        if (j === i) continue;
        const d = Math.hypot(p[0] - points[j][0], p[1] - points[j][1], p[2] - points[j][2]);
        if (d <= maxDist) cand.push([d, j]);
      }
    cand.sort((a, b) => a[0] - b[0]);
    for (const [, j] of cand.slice(0, k)) { const id = i < j ? `${i}-${j}` : `${j}-${i}`; if (!seen.has(id)) { seen.add(id); edges.push([i, j]); } }
  });
  return edges;
}
