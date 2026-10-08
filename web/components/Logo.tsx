/* Seven nodes in a ring joined by hairlines, one lit: the seven agents, the same graph the brain draws. */
export function LogoMark({ size = 26 }: { size?: number }) {
  const r = 10, c = 13;
  const pts = Array.from({ length: 7 }, (_, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 7; return [c + r * Math.cos(a), c + r * Math.sin(a)]; });
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden className="shrink-0">
      <g stroke="currentColor" strokeWidth="0.6" opacity="0.55">
        {pts.map(([x, y], i) => { const [nx, ny] = pts[(i + 1) % 7]; return <line key={i} x1={x} y1={y} x2={nx} y2={ny} />; })}
        {pts.map(([x, y], i) => { const [nx, ny] = pts[(i + 3) % 7]; return <line key={`c${i}`} x1={x} y1={y} x2={nx} y2={ny} opacity="0.5" />; })}
      </g>
      {pts.map(([x, y], i) => <circle key={`n${i}`} cx={x} cy={y} r={i === 0 ? 2.2 : 1.5} fill={i === 0 ? "var(--accent)" : "currentColor"} />)}
    </svg>
  );
}

export function Logo({ size = 26, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span className="font-serif text-[22px] font-semibold leading-none">Pantheon</span>
    </span>
  );
}
