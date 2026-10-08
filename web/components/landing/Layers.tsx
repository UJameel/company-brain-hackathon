import { Flow } from "./Flow";
import { Reveal } from "./Reveal";
const LAYERS = [
  ["Scalekit", "identity and connections", "Pulls from every system of record through the user's own connected accounts, any of 400+ connectors, and takes actions as them. No shared tokens anywhere."],
  ["Cognee", "memory", "One knowledge graph per person, tagged by source, channel and owner. Backend access control decides what each recall may read."],
  ["Respan", "gateway, traces, evals", "Every model call goes through the gateway. Every run is a traced workflow. Themis scores runs before and after a change."],
];
export function Layers() {
  return (
    <section id="layers" className="border-t border-line py-28">
      <Reveal><h2 className="max-w-[20ch] text-[clamp(34px,4.4vw,60px)]">Three layers, each doing one job.</h2></Reveal>
      <div className="mt-14 grid gap-10 md:grid-cols-3">
        {LAYERS.map(([name, role, body], i) => (
          <Reveal key={name} delay={i * 0.08} className="border-t border-line-2 pt-5">
            <div className="font-serif text-3xl font-semibold leading-none">{name}</div>
            <div className="my-3 font-mono text-[11px] uppercase tracking-[0.12em] text-accent">{role}</div>
            <p className="text-[14.5px] text-fg-2">{body}</p>
          </Reveal>
        ))}
      </div>
      <Reveal className="mt-24">
        <div className="insc mb-3">How they connect</div>
        <p className="max-w-[56ch] text-[17px] text-fg-2">One loop. Scalekit brings each system in as the person, Cognee remembers it in their own graph, Respan watches every call and scores the result.</p>
      </Reveal>
      <Reveal delay={0.1} className="mt-10"><Flow /></Reveal>
    </section>
  );
}
