import { Reveal } from "./Reveal";
export function Problem() {
  return (
    <section className="border-t border-line py-28">
      <Reveal><h2 className="max-w-[26ch] text-[clamp(34px,4.4vw,60px)]">Every brain bot today reads your company with one token that sees everything.</h2></Reveal>
      <Reveal><p className="mt-4 max-w-[56ch] text-[17px] text-fg-2">So either it leaks the leadership channel to a contractor, or you never connect the leadership channel. Pantheon pulls, remembers and answers as the person asking.</p></Reveal>
      <div className="mt-12 grid gap-12 md:grid-cols-2">
        <Reveal className="max-w-[46ch] border-t border-line-2 pt-4 text-fg-2"><b className="mb-2 block font-serif text-2xl font-semibold text-fg">The knowledge is already scattered.</b>The launch date is in one channel, the price change in another, the blocker in an issue, the plan in a wiki page, the contract in a mailbox. Nobody holds the whole picture.</Reveal>
        <Reveal className="max-w-[46ch] border-t border-line-2 pt-4 text-fg-2" delay={0.1}><b className="mb-2 block font-serif text-2xl font-semibold text-fg">Access is the product.</b>An engineering lead and a contractor ask the same question and get different, correct answers. The brain tells the contractor what exists that they can&apos;t read, and who owns it.</Reveal>
      </div>
    </section>
  );
}
