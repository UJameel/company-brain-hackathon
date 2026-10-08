import type { RegionName, Vec3 } from "./geometry";

export const CAMERA: Record<RegionName, { az: number; el: number; dist: number }> = {
  thalamus: { az: 60, el: 18, dist: 1.9 }, amygdala: { az: 95, el: -22, dist: 1.8 }, hippocampus: { az: 120, el: -30, dist: 1.8 },
  prefrontal: { az: 15, el: 8, dist: 2.1 }, motor: { az: 40, el: 70, dist: 2.0 }, orbitofrontal: { az: 20, el: -35, dist: 1.9 },
  sleep: { az: 0, el: 10, dist: 2.4 },
};
export const SLEEP_TURN_SECONDS = 40;

export function spring(current: number, target: number, velocity: number, dt: number, stiffness = 120, damping = 22): [number, number] {
  const accel = stiffness * (target - current) - damping * velocity;
  const v = velocity + accel * dt;
  return [current + v * dt, v];
}

export function orbitToPosition(azDeg: number, elDeg: number, dist: number): Vec3 {
  const az = (azDeg * Math.PI) / 180, el = (elDeg * Math.PI) / 180;
  return [dist * Math.cos(el) * Math.cos(az), dist * Math.sin(el), dist * Math.cos(el) * Math.sin(az)];
}
