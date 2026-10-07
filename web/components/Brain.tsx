"use client";
import { CAMERA, SLEEP_TURN_SECONDS, orbitToPosition, spring } from "@/lib/brain/choreo";
import { neighbours, regionOf, samplePoints, type RegionName, type Vec3 } from "@/lib/brain/geometry";
import { hasWebGL } from "@/lib/brain/webgl";
import type { Graph } from "@/lib/types";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Brain2D } from "./Brain2D";

export type BrainMode = "autoplay" | "scroll" | "live" | "graph";
const REGIONS: RegionName[] = ["thalamus", "amygdala", "hippocampus", "prefrontal", "motor", "orbitofrontal", "sleep"];
const ACCENT = new THREE.Color("#c8602c"), ACCENT_HI = new THREE.Color("#e8843f"), BONE = new THREE.Color("#efe6d8");

export type BrainProps = { mode: BrainMode; activeRegion?: RegionName | null; graph?: Graph; className?: string; onRegion?: (r: RegionName) => void };

export function Brain(props: BrainProps) {
  const [gl, setGl] = useState<boolean | null>(null);
  useEffect(() => setGl(hasWebGL()), []);
  if (gl === null) return <div className={props.className} aria-hidden />;
  if (!gl) return <Brain2D {...props} />;
  return <Brain3D {...props} />;
}

/* Real graph nodes carry positions from the layout worker (Task 11) in node.x/y/z scaled to the volume. */
function layoutFromGraph(graph: Graph): Vec3[] {
  return graph.nodes.map((n) => { const p = n as unknown as { x?: number; y?: number; z?: number }; return [p.x ?? 0, p.y ?? 0, p.z ?? 0]; });
}
function graphEdges(graph: Graph): [number, number][] {
  const idx = new Map(graph.nodes.map((n, i) => [n.id, i]));
  return graph.edges.flatMap((e) => { const a = idx.get(e.source), b = idx.get(e.target); return a != null && b != null ? [[a, b] as [number, number]] : []; });
}

function Brain3D({ mode, activeRegion, graph, className, onRegion }: BrainProps) {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef({ region: (activeRegion ?? "thalamus") as RegionName, azOffset: 0, pointer: [0, 0] as [number, number] });
  const onRegionRef = useRef(onRegion);
  useEffect(() => { onRegionRef.current = onRegion; }, [onRegion]);
  useEffect(() => { if (activeRegion) state.current.region = activeRegion; }, [activeRegion]);

  useEffect(() => {
    const el = host.current; if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.innerWidth < 768;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.domElement.style.display = "block";
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 20);

    const useGraph = Boolean(graph?.nodes.length);
    const pts: Vec3[] = useGraph ? layoutFromGraph(graph!) : samplePoints(small ? 1200 : 2400, 11);
    const regions = pts.map(regionOf);
    const edges = useGraph ? graphEdges(graph!) : neighbours(pts, 2, 0.09);
    const base = new Float32Array(pts.flat());
    const positions = new Float32Array(base);
    const colors = new Float32Array(pts.length * 3);
    const sizes = new Float32Array(pts.length);
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    pGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    pGeo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    const pMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
      uniforms: { dpr: { value: renderer.getPixelRatio() } },
      vertexShader: `attribute float size; uniform float dpr; varying vec3 vC; varying float vS; void main(){ vC=color; vS=size; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*dpr*(2.2/-mv.z); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 vC; varying float vS; void main(){ float d=length(gl_PointCoord-0.5); if(d>0.5) discard; float a=smoothstep(0.5,0.1,d); gl_FragColor=vec4(vC, a*(vS>2.5?0.95:0.35)); }`,
    });
    const points = new THREE.Points(pGeo, pMat); scene.add(points);
    const ePos = new Float32Array(edges.length * 6); const eCol = new Float32Array(edges.length * 6);
    const eGeo = new THREE.BufferGeometry();
    eGeo.setAttribute("position", new THREE.BufferAttribute(ePos, 3)); eGeo.setAttribute("color", new THREE.BufferAttribute(eCol, 3));
    const lines = new THREE.LineSegments(eGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(lines);

    const glow: Record<RegionName, number> = Object.fromEntries(REGIONS.map((r) => [r, 0])) as Record<RegionName, number>;
    let az = CAMERA.thalamus.az, el2 = CAMERA.thalamus.el, dist = CAMERA.thalamus.dist, vAz = 0, vEl = 0, vD = 0, t = 0, raf = 0, visible = true;
    const phase = pts.map((_, i) => (i * 0.618) % (Math.PI * 2));

    const resize = () => { const w = el.clientWidth || 1, h = el.clientHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    const ro = new ResizeObserver(resize); ro.observe(el); resize();
    const onMove = (e: PointerEvent) => { const b = el.getBoundingClientRect(); state.current.pointer = [((e.clientX - b.left) / b.width - 0.5) * 2, ((e.clientY - b.top) / b.height - 0.5) * 2]; };
    if (mode === "autoplay" && !reduce) el.addEventListener("pointermove", onMove);

    let auto = 0; let autoTimer = 0;
    if (mode === "autoplay" && !reduce) autoTimer = window.setInterval(() => { auto = (auto + 1) % REGIONS.length; state.current.region = REGIONS[auto]; onRegionRef.current?.(REGIONS[auto]); }, 2600);

    const frame = (dt: number) => {
      t += dt;
      const region = state.current.region; const target = CAMERA[region];
      const sleepAz = region === "sleep" ? ((t / SLEEP_TURN_SECONDS) * 360) % 360 : 0;
      const tAz = target.az + sleepAz + state.current.azOffset + (mode === "autoplay" ? state.current.pointer[0] * 6 : 0);
      const tEl = target.el + (mode === "autoplay" ? -state.current.pointer[1] * 6 : 0);
      if (reduce) { az = tAz; el2 = tEl; dist = target.dist; } else { [az, vAz] = spring(az, tAz, vAz, dt); [el2, vEl] = spring(el2, tEl, vEl, dt); [dist, vD] = spring(dist, target.dist, vD, dt); }
      const [cx, cy, cz] = orbitToPosition(az, el2, dist); camera.position.set(cx, cy, cz); camera.lookAt(0, 0, 0);
      for (const r of REGIONS) { const g = r === region ? 1 : 0; glow[r] = reduce ? g : glow[r] + (g - glow[r]) * Math.min(1, dt * 6); }
      const all = region === "sleep";
      for (let i = 0; i < pts.length; i++) {
        const r = regions[i]; const g = all ? glow.sleep * (0.6 + 0.4 * Math.sin(t * 1.3 + phase[i])) : (r !== "cortex" && r === region ? glow[r as RegionName] : 0);
        const wob = reduce ? 0 : Math.sin(t * 0.8 + phase[i]) * 0.004;
        positions[i * 3] = base[i * 3] + wob; positions[i * 3 + 1] = base[i * 3 + 1] + wob * 0.6; positions[i * 3 + 2] = base[i * 3 + 2];
        const c = g > 0.02 ? ACCENT_HI.clone().lerp(ACCENT, 1 - g) : BONE;
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b; sizes[i] = g > 0.02 ? 2.8 + 1.4 * g : 1.8;
      }
      edges.forEach(([a, b], k) => {
        const lit = !all && (regions[a] === region || regions[b] === region) ? glow[region] : all ? glow.sleep * 0.35 : 0;
        const c = lit > 0.02 ? ACCENT : BONE; const alpha = lit > 0.02 ? 0.4 * lit + 0.07 : 0.07;
        for (const [n, idx] of [[0, a], [1, b]] as const) {
          ePos.set([positions[idx * 3], positions[idx * 3 + 1], positions[idx * 3 + 2]], k * 6 + n * 3);
          eCol.set([c.r * alpha, c.g * alpha, c.b * alpha], k * 6 + n * 3);
        }
      });
      pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true; pGeo.attributes.size.needsUpdate = true;
      eGeo.attributes.position.needsUpdate = true; eGeo.attributes.color.needsUpdate = true;
      renderer.render(scene, camera);
    };
    let last = performance.now();
    const tick = (now: number) => { const dt = Math.min(0.05, (now - last) / 1000); last = now; frame(dt); raf = visible && !document.hidden && !reduce ? requestAnimationFrame(tick) : 0; };
    const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (visible && !raf && !reduce) { last = performance.now(); raf = requestAnimationFrame(tick); } }, { threshold: 0.05 }); io.observe(el);
    frame(0.016); if (!reduce) raf = requestAnimationFrame(tick);
    const onVis = () => { if (!document.hidden && visible && !raf && !reduce) { last = performance.now(); raf = requestAnimationFrame(tick); } };
    document.addEventListener("visibilitychange", onVis);
    const still = reduce ? window.setInterval(() => frame(0.016), 250) : 0;  // reduced motion: re-render on region change only

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); document.removeEventListener("visibilitychange", onVis); el.removeEventListener("pointermove", onMove);
      window.clearInterval(autoTimer); window.clearInterval(still);
      pGeo.dispose(); eGeo.dispose(); pMat.dispose(); (lines.material as THREE.Material).dispose(); renderer.dispose(); if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
    };
  }, [mode, graph]);

  return <div ref={host} className={className} aria-hidden style={{ position: "relative", overflow: "hidden" }} />;
}
