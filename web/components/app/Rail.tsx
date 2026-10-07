"use client";
import { ChatCircleText, Graph, Hammer, PlugsConnected, Scales } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserSwitch } from "./UserSwitch";

const ITEMS = [
  { href: "/app", label: "Chat", Icon: ChatCircleText },
  { href: "/app/actions", label: "Actions", Icon: Hammer },
  { href: "/app/graph", label: "Graph", Icon: Graph },
  { href: "/app/connections", label: "Connections", Icon: PlugsConnected },
  { href: "/app/evals", label: "Evals", Icon: Scales },
];

export function Rail() {
  const path = usePathname();
  return (
    <nav className="flex h-full w-56 shrink-0 flex-col border-r border-line bg-bg-2">
      <Link href="/" className="flex h-[72px] items-center gap-3 border-b border-line px-5 font-serif text-xl font-semibold uppercase tracking-[0.06em]">
        <span className="relative inline-block h-6 w-6 rounded-full border border-accent after:absolute after:inset-[6px] after:rounded-full after:bg-accent" />Pantheon
      </Link>
      <ul className="flex flex-col gap-1 p-3">
        {ITEMS.map(({ href, label, Icon }) => {
          const on = path === href;
          return (
            <li key={href}>
              <Link href={href} className={`flex items-center gap-3 rounded-[2px] px-3 py-2 text-sm ${on ? "bg-accent-dim text-fg" : "text-fg-2 hover:text-fg"}`}>
                <Icon size={18} weight="light" className={on ? "text-accent" : ""} />{label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto border-t border-line p-3"><UserSwitch /></div>
    </nav>
  );
}
