"use client";
import { Logo } from "@/components/Logo";
import { ChatCircleText, Graph, PlugsConnected } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/app", label: "Chat", Icon: ChatCircleText },
  { href: "/app/graph", label: "Graph", Icon: Graph },
  { href: "/app/connections", label: "Connections", Icon: PlugsConnected },
];

export function Rail() {
  const path = usePathname();
  return (
    <nav className="flex h-full w-56 shrink-0 flex-col border-r border-line bg-bg-2">
      <Link href="/" className="flex h-[72px] items-center border-b border-line px-5"><Logo size={24} /></Link>
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
    </nav>
  );
}
