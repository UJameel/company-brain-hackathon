"use client";
/* The three layers around Pantheon, drawn as one figure: each spoke is a step, drawn in order, with a pulse
   travelling the way the data does. Below md the figure is hidden and the four steps carry the story alone. */
import { motion, useReducedMotion } from "motion/react";

type Node = { id: string; name: string; role: string; x: number; y: number };
const HUB = { x: 550, y: 250, r: 52 };
const NODES: Node[] = [
  { id: "person", name: "A person", role: "signed in as themselves", x: 550, y: 56 },
  { id: "scalekit", name: "Scalekit", role: "identity · connections · actions", x: 160, y: 250 },
  { id: "cognee", name: "Cognee", role: "one graph per person", x: 940, y: 250 },
  { id: "respan", name: "Respan", role: "gateway · traces · evals", x: 550, y: 452 },
];
const W = 150, H = 48;  // stadium size

/* Steps in the order the figure draws them. `from` is the node, `both` draws an arrowhead at each end. */
const STEPS = [
  { n: 1, from: "scalekit", both: true, edge: "pulls · acts, as the person", text: "Connect once. Pantheon pulls every system through that person's own accounts, and acts as them on request." },
  { n: 2, from: "person", both: false, edge: "asks · decides", text: "Someone asks. The agents route the question and scope it to what that person may read." },
  { n: 3, from: "cognee", both: true, edge: "remembers · recalls, scoped", text: "Everything pulled lands in that person's own graph in Cognee. Recall reads only the datasets they own or were granted." },
  { n: 4, from: "respan", both: false, edge: "every call · trace · score", text: "Every model call goes through Respan, every run is a trace, and an independent judge scores the answer." },
];

function endpoints(node: Node): [number, number, number, number] {
  // from the stadium's edge to the hub's edge, so arrowheads sit on the shapes
  if (node.x < HUB.x) return [node.x + W / 2, node.y, HUB.x - HUB.r, HUB.y];
  if (node.x > HUB.x) return [node.x - W / 2, node.y, HUB.x + HUB.r, HUB.y];
  if (node.y < HUB.y) return [node.x, node.y + H / 2, HUB.x, HUB.y - HUB.r];
  return [node.x, node.y - H / 2, HUB.x, HUB.y + HUB.r];
}

function Ring({ x, y, r }: { x: number; y: number; r: number }) {
  const pts = Array.from({ length: 7 }, (_, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 7; return [x + r * Math.cos(a), y + r * Math.sin(a)]; });
  return (
    <g>
      <circle cx={x} cy={y} r={r + 14} fill="var(--bg-2)" stroke="var(--line-2)" />
      <g stroke="currentColor" strokeWidth="0.8" opacity="0.5">
        {pts.map(([px, py], i) => { const [nx, ny] = pts[(i + 1) % 7]; return <line key={i} x1={px} y1={py} x2={nx} y2={ny} />; })}
        {pts.map(([px, py], i) => { const [nx, ny] = pts[(i + 3) % 7]; return <line key={`c${i}`} x1={px} y1={py} x2={nx} y2={ny} opacity="0.5" />; })}
      </g>
      {pts.map(([px, py], i) => <circle key={`n${i}`} cx={px} cy={py} r={i === 0 ? 5 : 3.5} fill={i === 0 ? "var(--accent)" : "currentColor"} />)}
    </g>
  );
}

export function Flow() {
  const reduce = useReducedMotion();
  const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));
  return (
    <div className="grid gap-10">
      <svg role="img" aria-label="How the three layers connect around Pantheon" viewBox="0 0 1100 520" className="hidden w-full text-fg md:block">
        <defs>
          <marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)" />
          </marker>
        </defs>
        {STEPS.map((s, i) => {
          const node = byId[s.from];
          const [x1, y1, x2, y2] = endpoints(node);
          const d = `M${x1} ${y1} L${x2} ${y2}`;
          const vertical = x1 === x2;
          const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
          const delay = 0.2 + i * 0.45;
          return (
            <g key={s.n}>
              <motion.path d={d} fill="none" stroke="var(--line-2)" strokeWidth="1.5" markerEnd="url(#flow-arrow)" markerStart={s.both ? "url(#flow-arrow)" : undefined}
                initial={reduce ? false : { pathLength: 0, opacity: 0 }} whileInView={{ pathLength: 1, opacity: 1 }} viewport={{ once: true, amount: 0.5 }} transition={{ duration: 0.7, delay, ease: "easeOut" }} />
              {!reduce && (
                <circle r="3.5" fill="var(--accent-hi)" opacity="0.9">
                  <animateMotion dur="2.6s" begin={`${delay + 0.7}s`} repeatCount="indefinite" path={s.both && i % 2 ? d : d} keyPoints={s.from === "cognee" || s.from === "respan" ? "1;0" : "0;1"} keyTimes="0;1" calcMode="linear" />
                </circle>
              )}
              <motion.g initial={reduce ? false : { opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: delay + 0.3 }}>
                <text x={vertical ? mx + 12 : mx} y={vertical ? my + 4 : my - 12} textAnchor={vertical ? "start" : "middle"} className="font-mono" fontSize="11" letterSpacing="0.12em" fill="var(--accent)" stroke="var(--bg)" strokeWidth="6" paintOrder="stroke">
                  {s.n} · {s.edge.toUpperCase()}
                </text>
              </motion.g>
            </g>
          );
        })}
        {NODES.map((n, i) => (
          <motion.g key={n.id} initial={reduce ? false : { opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.1 + i * 0.08 }} style={{ transformOrigin: `${n.x}px ${n.y}px` }}>
            <rect x={n.x - W / 2} y={n.y - H / 2} width={W} height={H} rx={H / 2} fill="var(--bg-2)" stroke={n.id === "person" ? "var(--line)" : "var(--accent)"} strokeOpacity={n.id === "person" ? 1 : 0.7} />
            <text x={n.x} y={n.y + 7} textAnchor="middle" className="font-serif" fontSize="21" fontWeight="600" fill="currentColor">{n.name}</text>
            <text x={n.x} y={n.y + (n.y < HUB.y ? -H / 2 - 10 : H / 2 + 20)} textAnchor="middle" className="font-mono" fontSize="11" letterSpacing="0.1em" fill="var(--muted)">{n.role.toUpperCase()}</text>
          </motion.g>
        ))}
        <Ring x={HUB.x} y={HUB.y} r={HUB.r - 18} />
        {/* the hub label lives on the free diagonal, clear of all four spokes */}
        <text x={HUB.x + HUB.r + 18} y={HUB.y - HUB.r + 2} className="font-serif" fontSize="24" fontWeight="600" fill="currentColor">Pantheon</text>
        <text x={HUB.x + HUB.r + 18} y={HUB.y - HUB.r + 20} className="font-mono" fontSize="11" letterSpacing="0.1em" fill="var(--muted)">SEVEN AGENTS</text>
      </svg>
      <ol className="grid gap-6 md:grid-cols-4">
        {STEPS.map((s) => (
          <li key={s.n} className="border-t border-line-2 pt-4">
            <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">{s.n} · {byId[s.from].name === "A person" ? "ask" : byId[s.from].name}</div>
            <p className="mt-2 text-[14px] text-fg-2">{s.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
