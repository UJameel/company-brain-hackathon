import { Reveal } from "./Reveal";
const BEATS = [
  { k: "before", h: "Isolation", p: "A contractor with only Slack connected asks about the launch risk.", ex: ["Cerberus: may read ['contractor-brain']; hidden ['lead-brain']", "Athena: 3 passages from ['source:slack']", "~The fallback date: not in the answer"] },
  { k: "the grant", h: "The lead shares", p: "The engineering lead grants the contractor read on their dataset. Cognee records the permission, performed as the lead.", ex: ["cerberus.grant(owner=lead, to=contractor)", "*lead granted read on lead-brain to contractor"], lit: true },
  { k: "after", h: "Changed result", p: "Same question, re-asked. The answer is grounded in GitHub and Notion too, and the eval moves.", ex: ["Cerberus: may read ['lead-brain', 'contractor-brain']", "Athena: 7 passages from ['source:github', 'source:notion', 'source:slack']", "*coverage 0.89 to 1.00"] },
];
export function AccessStory() {
  return (
    <section id="access" className="border-t border-line py-28">
      <Reveal><h2 className="max-w-[20ch] text-[clamp(34px,4.4vw,60px)]">Isolation, then a grant, then the answer changes.</h2></Reveal>
      <Reveal><p className="mt-4 max-w-[56ch] text-[17px] text-fg-2">Each person&apos;s dataset holds only what their own connections could pull. One permission write, made as the owner, changes what the brain will say.</p></Reveal>
      <div className="mt-14 grid gap-px border border-line bg-line md:grid-cols-3">
        {BEATS.map((b, i) => (
          <Reveal key={b.k} delay={i * 0.08} className={`flex flex-col gap-4 bg-bg p-7 ${b.lit ? "bg-[linear-gradient(180deg,var(--accent-dim),transparent_60%)]" : ""}`}>
            <h3 className="text-3xl"><span className="mb-2.5 block font-mono text-[11px] font-normal uppercase tracking-[0.14em] text-muted">{b.k}</span>{b.h}</h3>
            <p className="max-w-[40ch] text-[14.5px] text-fg-2">{b.p}</p>
            <div className="mt-auto overflow-x-auto border border-line bg-bg-2 px-3.5 py-3 font-mono text-[12px] leading-relaxed text-fg-2">
              {b.ex.map((l) => l.startsWith("*") ? <div key={l} className="text-accent">{l.slice(1)}</div> : l.startsWith("~") ? <s key={l} className="block text-muted">{l.slice(1)}</s> : <div key={l}>{l}</div>)}
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
