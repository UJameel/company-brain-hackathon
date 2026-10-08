import Link from "next/link";
export function Nav() {
  return (
    <nav className="flex h-[72px] items-center justify-between gap-6">
      <Link href="/" className="flex items-center gap-3 font-serif text-[22px] font-semibold uppercase tracking-[0.06em]">
        <span className="relative inline-block h-[26px] w-[26px] rounded-full border-[1.5px] border-accent after:absolute after:inset-[6px] after:rounded-full after:bg-accent" />Pantheon
      </Link>
      <ul className="hidden gap-8 text-[13.5px] text-fg-2 md:flex">
        {[["#pantheon", "The brain"], ["#access", "Access"], ["#layers", "Layers"], ["#evaluation", "Evaluation"]].map(([h, l]) => <li key={h}><a href={h}>{l}</a></li>)}
      </ul>
      <Link href="/app" className="btn btn-sm btn-primary">Open the app</Link>
    </nav>
  );
}
